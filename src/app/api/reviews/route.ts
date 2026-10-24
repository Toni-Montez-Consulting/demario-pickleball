import { NextRequest, NextResponse, after } from "next/server";
import { createServiceRoleClient, requireAdmin } from "@/lib/supabase/server";
import { checkRateLimit, hashRequestIp } from "@/lib/rate-limit";
import { validateReviewInput, hashReviewToken } from "@/lib/reviews";
import { findOrCreateStudent } from "@/lib/students";
import { sendReviewNotificationEmail } from "@/lib/email/client";
import { moderationSecret, signReviewActionToken, type ReviewAction } from "@/lib/review-moderation";
import { SITE_URL } from "@/lib/site";

/**
 * Public review submission. Two paths:
 *
 *   tokenized — the link emailed 24h after a lesson. Fills in the pending row
 *               the cron created, and is marked verified. With words, it goes
 *               live at once, at any rating; DeMario's email can take it down.
 *   public    — the /review link Mario shares with past clients. Creates a new
 *               unverified row, matched to a student when contact details allow.
 *               It waits, and DeMario's email can publish it.
 * Design: docs/specs/2026-10-22-automatic-reviews.md
 */

/**
 * Emails DeMario about a submitted review, after the response. A live review
 * gets a takedown link, a waiting one a publish link, and a rating with no
 * words (which cannot show on the site) neither.
 */
function notifyDeMario(review: {
  id: string;
  displayName: string;
  rating: number;
  body: string | null;
  verified: boolean;
  live: boolean;
}) {
  const secret = moderationSecret();
  const action: ReviewAction | null = review.live ? "hide" : review.body ? "publish" : null;
  if (action && !secret) {
    console.error("[reviews POST] LESSON_OUTCOME_SECRET is not set; review email has no one-tap link");
  }
  const actionUrl =
    action && secret
      ? `${SITE_URL}/review-action/${signReviewActionToken({ reviewId: review.id, action, secret })}`
      : null;
  after(() =>
    sendReviewNotificationEmail({
      displayName: review.displayName,
      rating: review.rating,
      body: review.body,
      verified: review.verified,
      live: review.live,
      actionUrl,
    }).catch((err) => console.error("[reviews POST] review email failed", err))
  );
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Honeypot, same field name the contact form uses.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "reviews",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  const validation = validateReviewInput({
    rating: body.rating,
    body: body.body,
    displayName: body.displayName,
    consent: body.consent,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { rating, body: text, displayName } = validation.value;

  if (typeof body.token === "string" && body.token) {
    const { data: pending, error: findError } = await supabase
      .from("reviews")
      .select("id,token_used_at")
      .eq("token_hash", hashReviewToken(body.token))
      .maybeSingle();

    if (findError) {
      console.error("[reviews POST] token lookup failed", findError);
      return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
    }
    if (!pending) {
      return NextResponse.json({ error: "This review link is not valid" }, { status: 404 });
    }
    if (pending.token_used_at) {
      return NextResponse.json({ error: "This review was already submitted" }, { status: 409 });
    }

    // Tied to a real lesson and consented, so a review with words goes live now,
    // at any rating (Tonio, 2026-10-22). Filtering by stars is not allowed: the
    // federal review rule bars implying all reviews show while low ones are
    // held back. DeMario can take down an abusive, fake, or untrue one.
    const submittedAt = new Date().toISOString();
    const live = text !== null;
    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        rating,
        body: text,
        display_name: displayName,
        consent_publish: true,
        token_used_at: submittedAt,
        submitted_ip_hash: hashRequestIp(req),
        ...(live ? { status: "published", published_at: submittedAt } : {}),
      })
      .eq("id", pending.id);

    if (updateError) {
      console.error("[reviews POST] token submit failed", updateError);
      return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
    }
    notifyDeMario({ id: pending.id, displayName, rating, body: text, verified: true, live });
    return NextResponse.json({ ok: true, verified: true, published: live }, { status: 201 });
  }

  // Public path. Unverified, matched to a student when we can.
  let studentId: string | null = null;
  if (typeof body.contact === "string" && body.contact.trim()) {
    const contact = body.contact.trim();
    const looksLikeEmail = contact.includes("@");
    const match = await findOrCreateStudent(supabase, {
      name: displayName,
      email: looksLikeEmail ? contact : "",
      phone: looksLikeEmail ? "" : contact,
      source: "import",
      // displayName is "Rachel K.", not the name they booked under. Comparing it
      // would flag every honest public review as a conflict on a real student.
      compareName: false,
    });
    studentId = match?.student.id ?? null;
  }

  // Anyone can open the public page, so its reviews wait for DeMario's one tap.
  const { data: created, error: insertError } = await supabase
    .from("reviews")
    .insert({
      student_id: studentId,
      rating,
      body: text,
      display_name: displayName,
      consent_publish: true,
      verified_booking: false,
      source: "site",
      status: "pending",
      submitted_ip_hash: hashRequestIp(req),
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("[reviews POST] insert failed", insertError);
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
  }
  notifyDeMario({ id: created.id, displayName, rating, body: text, verified: false, live: false });
  return NextResponse.json({ ok: true, verified: false, published: false }, { status: 201 });
}

/** Admin moderation list. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const status = req.nextUrl.searchParams.get("status");
  let query = admin.supabase.from("reviews").select("*").order("created_at", { ascending: false });

  if (status && ["pending", "published", "hidden"].includes(status)) {
    query = query.eq("status", status);
  }

  // Only rows the student actually submitted. A tokenized row created by the
  // cron carries placeholder values until it is filled in, so it stays out of
  // the queue until token_used_at is stamped. Public submissions have no token.
  query = query.or("token_hash.is.null,token_used_at.not.is.null");

  const { data, error } = await query;
  if (error) {
    console.error("[reviews GET]", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
  return NextResponse.json(data);
}
