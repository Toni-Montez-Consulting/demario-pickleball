import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

export type DayStatus = "past" | "blocked" | "has-booking" | "partial" | "available";

const BOOKING_TZ = "America/Chicago";

function todayInTz(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const params = req.nextUrl.searchParams;
  const yearParam = parseInt(params.get("year") ?? "", 10);
  const monthParam = parseInt(params.get("month") ?? "", 10);

  if (!yearParam || !monthParam || monthParam < 1 || monthParam > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const firstDay = isoDate(yearParam, monthParam, 1);
  const lastDay = isoDate(yearParam, monthParam, daysInMonth(yearParam, monthParam));
  const today = todayInTz();

  const [blockedRes, bookingsRes, recurringRes, slotsRes] = await Promise.all([
    admin.supabase
      .from("blocked_slots")
      .select("date, time, all_day")
      .gte("date", firstDay)
      .lte("date", lastDay),
    admin.supabase
      .from("bookings")
      .select("lesson_date, lesson_time")
      .gte("lesson_date", firstDay)
      .lte("lesson_date", lastDay)
      .neq("status", "cancelled"),
    admin.supabase.from("recurring_blocks").select("day_of_week, time"),
    admin.supabase.from("time_slots").select("display_label").eq("active", true),
  ]);

  if (blockedRes.error || bookingsRes.error || recurringRes.error || slotsRes.error) {
    console.error("[availability/month]", blockedRes.error ?? bookingsRes.error ?? recurringRes.error ?? slotsRes.error);
    return NextResponse.json({ error: "Failed to load calendar data." }, { status: 500 });
  }

  const activeSlotCount = (slotsRes.data ?? []).length;

  // Index blocked slots by date
  const blockedByDate = new Map<string, { allDay: boolean; times: Set<string> }>();
  for (const b of blockedRes.data ?? []) {
    if (!blockedByDate.has(b.date)) blockedByDate.set(b.date, { allDay: false, times: new Set() });
    const entry = blockedByDate.get(b.date)!;
    if (b.all_day) entry.allDay = true;
    if (b.time) entry.times.add(b.time);
  }

  // Index bookings by date
  const bookingsByDate = new Map<string, number>();
  for (const bk of bookingsRes.data ?? []) {
    bookingsByDate.set(bk.lesson_date, (bookingsByDate.get(bk.lesson_date) ?? 0) + 1);
  }

  // Index recurring blocks by day-of-week
  const recurringByDow = new Map<number, { allDay: boolean; times: Set<string> }>();
  for (const r of recurringRes.data ?? []) {
    if (!recurringByDow.has(r.day_of_week)) recurringByDow.set(r.day_of_week, { allDay: false, times: new Set() });
    const entry = recurringByDow.get(r.day_of_week)!;
    if (r.time === null) entry.allDay = true;
    else entry.times.add(r.time);
  }

  const days: Record<string, DayStatus> = {};
  const total = daysInMonth(yearParam, monthParam);

  for (let d = 1; d <= total; d++) {
    const dateStr = isoDate(yearParam, monthParam, d);
    const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();

    if (dateStr < today) {
      days[dateStr] = "past";
      continue;
    }

    // Collect total blocked time count for this day
    const oneOff = blockedByDate.get(dateStr);
    const recurring = recurringByDow.get(dow);
    const hasBooking = (bookingsByDate.get(dateStr) ?? 0) > 0;

    const allDayBlocked = oneOff?.allDay || recurring?.allDay;
    if (allDayBlocked) {
      days[dateStr] = "blocked";
      continue;
    }

    // Count unique blocked times from both sources
    const blockedTimes = new Set<string>([
      ...(oneOff?.times ?? []),
      ...(recurring?.times ?? []),
    ]);

    if (activeSlotCount > 0 && blockedTimes.size >= activeSlotCount) {
      days[dateStr] = "blocked";
    } else if (hasBooking) {
      days[dateStr] = "has-booking";
    } else if (blockedTimes.size > 0) {
      days[dateStr] = "partial";
    } else {
      days[dateStr] = "available";
    }
  }

  return NextResponse.json({ days, year: yearParam, month: monthParam });
}
