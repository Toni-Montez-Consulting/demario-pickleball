import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import {
  getAvailabilityForDate,
  isValidDateString,
  isWithinPublicBookingWindow,
} from "@/lib/availability";
import { getGoogleCalendarBusyForDateCached, isGoogleCalendarSyncEnabled } from "@/lib/google-calendar";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  const lessonType = req.nextUrl.searchParams.get("lesson_type") ?? undefined;
  if (!date || !isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Students can only book the next 30 days, so no other date needs an answer,
  // and each answer can cost a Google Calendar query.
  if (!isWithinPublicBookingWindow(date)) {
    return NextResponse.json({ error: "Bookings are available for the next 30 days." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await getAvailabilityForDate(supabase, date, {
    lessonType,
    busyProvider: getGoogleCalendarBusyForDateCached,
  });
  if (error || !data) {
    console.error("[availability GET]", error);
    // Students now see "Could not load availability" and cannot book. A dead
    // calendar token looks exactly like this, so it is reported, not only logged.
    Sentry.captureMessage(`[availability GET] ${error ?? "no data"}`, {
      level: "error",
      tags: { route: "availability" },
    });
    return NextResponse.json({ error: "Failed to load availability." }, { status: 500 });
  }

  return NextResponse.json({
    allDay: data.allDay,
    unavailable: data.unavailable,
    booked: data.unavailable,
    // False means DeMario's Google Calendar was not consulted: the switch is
    // off or misspelled, so his other lessons show as open times. Any Google
    // failure is a 500 above. The hourly site-health check fails on false.
    calendarSync: isGoogleCalendarSyncEnabled(),
  });
}
