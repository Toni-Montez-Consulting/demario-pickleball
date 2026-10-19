import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendLessonOutcomeDigest } from "@/lib/email/client";
import { parseBookingNotes } from "@/lib/booking-notes";
import {
  formatLessonDate,
  outcomeSecret,
  reminderWindow,
  signOutcomeToken,
  OUTCOMES,
  type LessonOutcome,
} from "@/lib/lesson-outcomes";
import { SITE_URL } from "@/lib/site";
import { parseDisplayTime } from "@/lib/time";

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

/**
 * Daily Vercel cron, two hours before the review-request cron. Emails Mario
 * one digest of site-booked lessons from the last three days that are still
 * `pending`, with one-tap outcome links. Sends nothing when nothing is pending.
 * Design: docs/specs/2026-10-19-lesson-outcome-nudge.md
 *
 * The review cron only asks about `confirmed` bookings, and nothing else ever
 * moved a booking out of `pending`, so before this no review request was
 * ever sent.
 */
export async function GET(req: NextRequest) {
  // Missing configuration is a deployment problem, not a rejected caller, so
  // it is a logged 500 rather than a 401 (same reasoning as review-requests).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron lesson-outcomes] CRON_SECRET is not set; no digest can be sent");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const linkSecret = outcomeSecret();
  if (!linkSecret) {
    console.error("[cron lesson-outcomes] LESSON_OUTCOME_SECRET is not set; no digest can be sent");
    return NextResponse.json({ error: "Outcome links are not configured" }, { status: 500 });
  }

  const now = new Date();
  const { from, to } = reminderWindow(now);
  const supabase = createServiceRoleClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id,name,lesson_type,lesson_date,lesson_time,notes")
    .eq("status", "pending")
    .gte("lesson_date", from)
    .lte("lesson_date", to);

  if (error) {
    console.error("[cron lesson-outcomes] booking query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ lessons: 0, sent: false });
  }

  const link = (bookingId: string, outcome: LessonOutcome) =>
    `${SITE_URL}/lesson-outcome/${signOutcomeToken({ bookingId, outcome, secret: linkSecret, now })}`;

  // lesson_time is a label ("9:00 AM"), which sorts wrong as text.
  const minutes = (label: string) => {
    const t = parseDisplayTime(label);
    return t ? t.hour * 60 + t.minute : 0;
  };
  const ordered = [...bookings].sort(
    (a, b) => a.lesson_date.localeCompare(b.lesson_date) || minutes(a.lesson_time) - minutes(b.lesson_time)
  );

  const lessons = ordered.map((booking) => ({
    name: booking.name,
    lessonName: LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type,
    when: `${formatLessonDate(booking.lesson_date)} · ${booking.lesson_time} CT`,
    courtSetup: parseBookingNotes(booking.notes).courtSetup,
    links: Object.fromEntries(OUTCOMES.map((o) => [o, link(booking.id, o)])) as Record<
      LessonOutcome,
      string
    >,
  }));

  const sent = await sendLessonOutcomeDigest(lessons);
  if (!sent) {
    console.error("[cron lesson-outcomes] digest send failed", { lessons: lessons.length });
    return NextResponse.json({ lessons: lessons.length, sent: false }, { status: 502 });
  }
  // Counts only. The response is visible in Vercel's cron logs.
  return NextResponse.json({ lessons: lessons.length, sent: true });
}
