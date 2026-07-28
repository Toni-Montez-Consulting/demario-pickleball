import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  isEligibleForReviewRequest,
  generateReviewToken,
  hashReviewToken,
  defaultDisplayName,
  type ReviewEligibleBooking,
} from "@/lib/reviews";
import { sendReviewRequestEmail } from "@/lib/email/client";
import { SITE_URL } from "@/lib/site";

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

/** Do not ask the same student for a review more than once a quarter. */
const REASK_WINDOW_DAYS = 90;

/** Only look back a month. Older bookings are not worth an unexpected email. */
const LOOKBACK_DAYS = 30;

/**
 * Ceiling on emails per run. A normal day is a handful of lessons; anything
 * near this cap means a backlog was confirmed at once, and blasting it would be
 * the wrong call. What gets deferred is logged, never silently dropped.
 */
const MAX_SENDS_PER_RUN = 25;

type CronBooking = ReviewEligibleBooking & {
  name: string;
  email: string;
  lesson_type: string;
};

/**
 * Daily Vercel cron. Emails a private review link 24 hours after each lesson.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically once the
 * variable is set on the project. The route is a public URL otherwise, so the
 * check is the first thing that happens.
 */
export async function GET(req: NextRequest) {
  // A missing secret is a deployment misconfiguration, not a rejected caller.
  // Collapsing both into 401 would make a cron that never runs look identical to
  // a bot being turned away — silent, and invisible in the logs.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron review-requests] CRON_SECRET is not set; no review requests can be sent");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 3_600_000)
    .toISOString()
    .slice(0, 10);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id,name,email,status,lesson_type,lesson_date,lesson_time,student_id,review_request_sent_at"
    )
    .gte("lesson_date", lookback)
    .is("review_request_sent_at", null);

  if (error) {
    console.error("[cron review-requests] booking query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  const skipped: Record<string, number> = {};
  const failed: string[] = [];

  let deferred = 0;

  for (const booking of (bookings ?? []) as CronBooking[]) {
    if (sent >= MAX_SENDS_PER_RUN) {
      deferred++;
      continue;
    }

    const eligibility = isEligibleForReviewRequest(booking, now);
    if (!eligibility.eligible) {
      const reason = eligibility.reason ?? "unknown";
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }

    const since = new Date(now.getTime() - REASK_WINDOW_DAYS * 24 * 3_600_000).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from("reviews")
      .select("id")
      .eq("student_id", booking.student_id)
      .gte("created_at", since)
      .limit(1);

    // A failed dedupe check must not be read as "never asked". Skip and report
    // rather than risk emailing a student twice.
    if (recentError) {
      console.error("[cron review-requests] dedupe check failed", booking.id, recentError);
      failed.push(booking.id);
      continue;
    }

    if (recent && recent.length > 0) {
      skipped["asked within 90 days"] = (skipped["asked within 90 days"] ?? 0) + 1;
      continue;
    }

    const token = generateReviewToken();

    // Send first, then persist. The reverse order meant a failed send left a
    // pending row whose token nobody had, which the 90-day dedupe then counted
    // as "already asked" — silencing that student for a quarter.
    const ok = await sendReviewRequestEmail({
      to: booking.email,
      name: booking.name,
      lessonName: LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type,
      lessonDate: booking.lesson_date,
      reviewUrl: `${SITE_URL}/review/${token}`,
    });

    if (!ok) {
      console.error("[cron review-requests] email send failed", booking.id);
      failed.push(booking.id);
      continue;
    }

    // Placeholder rating and display name. The row is not submittable and is
    // filtered out of the admin queue until token_used_at is stamped; the
    // student's real values overwrite these on submit.
    const { error: createError } = await supabase.from("reviews").insert({
      student_id: booking.student_id,
      booking_id: booking.id,
      rating: 5,
      display_name: defaultDisplayName(booking.name),
      consent_publish: true,
      verified_booking: true,
      source: "site",
      status: "pending",
      token_hash: hashReviewToken(token),
    });

    if (createError) {
      console.error("[cron review-requests] review row failed after send", booking.id, createError);
      failed.push(booking.id);
      continue;
    }

    const { error: stampError } = await supabase
      .from("bookings")
      .update({ review_request_sent_at: now.toISOString() })
      .eq("id", booking.id);

    if (stampError) {
      console.error("[cron review-requests] stamp failed", booking.id, stampError);
      failed.push(booking.id);
      continue;
    }
    sent++;
  }

  // Failures are named, never swallowed.
  if (failed.length > 0) {
    console.error("[cron review-requests] failed bookings", failed);
  }
  // Neither is a truncated run. A silent cap reads as "we asked everyone".
  if (deferred > 0) {
    console.warn(
      `[cron review-requests] hit the ${MAX_SENDS_PER_RUN}/run ceiling; ${deferred} booking(s) deferred to the next run`
    );
  }
  return NextResponse.json({ sent, skipped, failed, deferred });
}
