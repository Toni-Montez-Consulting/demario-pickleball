import { NextRequest, NextResponse } from "next/server";
import { hasCronCredential } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendCoachTomorrowEmail } from "@/lib/email/client";
import { parseBookingNotes } from "@/lib/booking-notes";
import { cancelLessonUrl } from "@/lib/lesson-cancel";
import { reminderLessonDate } from "@/lib/lesson-reminders";
import { lessonName } from "@/lib/lesson-types";
import { playersLabel } from "@/lib/session-pricing";
import { formatLessonDate, parseDisplayTime } from "@/lib/time";

/**
 * Daily Vercel cron at 14:00 UTC, nine hours before the students' reminders
 * (23:00 UTC). Emails DeMario tomorrow's pending site lessons, each with the
 * student's number and a one-tap Cancel, so a lesson he called off by text is
 * cancelled before its student hears "See you tomorrow". Sends nothing when
 * there are no lessons tomorrow.
 *
 * No claim before sending, the same as the morning outcome digest: if Vercel
 * starts a run twice, DeMario gets the email twice. Nothing reaches a student,
 * so a duplicate is tolerated rather than adding a column to prevent it.
 * Design: docs/specs/2026-10-23-one-tap-cancel.md
 */
export async function GET(req: NextRequest) {
  const cronToken = process.env.CRON_SECRET;
  if (!cronToken) {
    console.error("[cron coach-tomorrow] CRON_SECRET is not set; no email can be sent");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
  }
  if (!hasCronCredential(req.headers.get("authorization"), cronToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = reminderLessonDate(now);
  const { data: bookings, error } = await createServiceRoleClient()
    .from("bookings")
    .select("id,name,phone,lesson_type,lesson_date,lesson_time,notes,group_size")
    .eq("status", "pending")
    .eq("lesson_date", tomorrow);

  if (error) {
    console.error("[cron coach-tomorrow] booking query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ lessons: 0, sent: false });
  }

  // lesson_time is a label ("9:00 AM"), which sorts wrong as text. A label
  // that does not parse is listed first and logged, never silently placed.
  const minutes = (label: string) => {
    const t = parseDisplayTime(label);
    if (!t) {
      console.warn("[cron coach-tomorrow] unreadable lesson time; listed first", label);
      return -1;
    }
    return t.hour * 60 + t.minute;
  };
  const lessons = [...bookings]
    .sort((a, b) => minutes(a.lesson_time) - minutes(b.lesson_time))
    .map((booking) => {
      const court = parseBookingNotes(booking.notes);
      return {
        name: booking.name,
        phone: booking.phone ?? null,
        lessonName: lessonName(booking.lesson_type),
        players: booking.group_size ? playersLabel(booking.group_size) : null,
        time: booking.lesson_time,
        courtSetup: court.courtSetup,
        preferredArea: court.preferredArea,
        // Null without the link secret: the email then shows no Cancel line.
        cancelUrl: cancelLessonUrl(booking.id, now),
      };
    });

  const sent = await sendCoachTomorrowEmail(lessons, formatLessonDate(tomorrow));
  if (!sent) {
    console.error("[cron coach-tomorrow] email send failed", { lessons: lessons.length });
    return NextResponse.json({ lessons: lessons.length, sent: false }, { status: 502 });
  }
  // Counts only. The response is visible in Vercel's cron logs.
  return NextResponse.json({ lessons: lessons.length, sent: true });
}
