import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleCalendarBusyForDate,
  getGoogleCalendarSyncConfigStatus,
} from "@/lib/google-calendar";
import { isValidDateString } from "@/lib/availability";
import { requireAdmin } from "@/lib/supabase/server";

function tomorrowDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const requestedDate = req.nextUrl.searchParams.get("date") ?? tomorrowDateString();
  if (!isValidDateString(requestedDate)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const status = getGoogleCalendarSyncConfigStatus();
  if (!status.enabled) {
    return NextResponse.json({
      ...status,
      checkedDate: requestedDate,
      ok: false,
      busyCount: 0,
      error: "Google Calendar sync is disabled.",
    });
  }
  if (!status.configured) {
    return NextResponse.json({
      ...status,
      checkedDate: requestedDate,
      ok: false,
      busyCount: 0,
      error: "Google Calendar OAuth env vars are incomplete.",
    });
  }

  const result = await getGoogleCalendarBusyForDate(requestedDate);
  return NextResponse.json({
    ...status,
    checkedDate: requestedDate,
    ok: !result.error,
    busyCount: result.busy.length,
    error: result.error,
  });
}

