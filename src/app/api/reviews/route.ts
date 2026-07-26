import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, requireAdmin } from "@/lib/supabase/server";
import { checkRateLimit, hashRequestIp } from "@/lib/rate-limit";
import { validateReviewInput, hashReviewToken } from "@/lib/reviews";
import { findOrCreateStudent } from "@/lib/students";

/**
 * Public review submission. Two paths:
 *
 *   tokenized — the link emailed 24h after a lesson. Fills in the pending row
 *               the cron created, and is marked verified.
 *   public    — the /review link Mario shares with past clients. Creates a new
 *               unverified row, matched to a student when contact details allow.
 *
 * Both land in the pending queue. Nothing reaches the site without Mario.
 */
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

    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        rating,
        body: text,
        display_name: displayName,
        consent_publish: true,
        token_used_at: new Date().toISOString(),
        submitted_ip_hash: hashRequestIp(req),
      })
      .eq("id", pending.id);

    if (updateError) {
      console.error("[reviews POST] token submit failed", updateError);
      return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, verified: true }, { status: 201 });
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
    });
    studentId = match?.student.id ?? null;
  }

  const { error: insertError } = await supabase.from("reviews").insert({
    student_id: studentId,
    rating,
    body: text,
    display_name: displayName,
    consent_publish: true,
    verified_booking: false,
    source: "site",
    status: "pending",
    submitted_ip_hash: hashRequestIp(req),
  });

  if (insertError) {
    console.error("[reviews POST] insert failed", insertError);
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, verified: false }, { status: 201 });
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
