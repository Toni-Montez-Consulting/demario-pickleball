import { NextRequest, NextResponse } from "next/server";
import { hasCronCredential } from "@/lib/cron-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendLessonReminderEmail } from "@/lib/email/client";
import { isDueForReminder, reminderLessonDate, type ReminderBooking } from "@/lib/lesson-reminders";
import type { IcsBooking } from "@/lib/email/ics";

/**
 * Ceiling on emails per run. DeMario teaches a handful of site lessons a day;
 * anything near this means something is wrong, and what is deferred is logged.
 */
const MAX_SENDS_PER_RUN = 25;

type CronBooking = ReminderBooking & IcsBooking;

/**
 * Daily Vercel cron. Emails each student the day before a lesson booked on the
 * site. Same shape as the review-request cron: check the cron credential, claim
 * each booking before sending, release the claim if the send fails.
 */
export async function GET(req: NextRequest) {
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken) {
    console.error("[cron lesson-reminders] CRON_SECRET is not set; no reminders can be sent");
    return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
  }
  if (!hasCronCredential(req.headers.get("authorization"), expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id,name,email,phone,status,lesson_type,lesson_date,lesson_time,notes,created_at,reminder_sent_at,group_size,quoted_per_person_cents,quoted_total_cents"
    )
    .eq("lesson_date", reminderLessonDate(now))
    .eq("status", "pending")
    .is("reminder_sent_at", null);

  // Includes the column not existing yet: the migration must run before this ships.
  if (error) {
    console.error("[cron lesson-reminders] booking query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  let deferred = 0;
  const skipped: Record<string, number> = {};
  const failed: string[] = [];

  for (const booking of (bookings ?? []) as CronBooking[]) {
    if (sent >= MAX_SENDS_PER_RUN) {
      deferred++;
      continue;
    }

    const check = isDueForReminder(booking, now);
    if (!check.due) {
      skipped[check.reason] = (skipped[check.reason] ?? 0) + 1;
      continue;
    }

    // Claim first: Vercel can occasionally start the same run twice, and only
    // the run whose stamp lands may send.
    const { data: claimed, error: claimError } = await supabase
      .from("bookings")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", booking.id)
      .is("reminder_sent_at", null)
      .select("id");

    if (claimError) {
      console.error("[cron lesson-reminders] claim failed", booking.id, claimError);
      failed.push(booking.id);
      continue;
    }
    if (!claimed || claimed.length === 0) {
      skipped["claimed by another run"] = (skipped["claimed by another run"] ?? 0) + 1;
      continue;
    }

    const ok = await sendLessonReminderEmail(booking);
    if (!ok) {
      // Release the claim so the record says nothing was sent. The next daily
      // run is after the lesson date, so there is no retry; the failure is logged.
      const { error: releaseError } = await supabase
        .from("bookings")
        .update({ reminder_sent_at: null })
        .eq("id", booking.id);
      if (releaseError) {
        console.error("[cron lesson-reminders] could not release claim", booking.id, releaseError);
      }
      failed.push(booking.id);
      continue;
    }
    sent++;
  }

  if (failed.length > 0) {
    console.error("[cron lesson-reminders] failed bookings", failed);
  }
  if (deferred > 0) {
    console.warn(
      `[cron lesson-reminders] hit the ${MAX_SENDS_PER_RUN}/run ceiling; ${deferred} booking(s) not reminded`
    );
  }
  return NextResponse.json({ sent, skipped, failed, deferred });
}
