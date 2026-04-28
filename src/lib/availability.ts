import type { SupabaseClient } from "@supabase/supabase-js";
import { LESSON_DURATION_MINUTES } from "@/lib/business";
import { getGoogleCalendarBusyForDate, type BusyInterval } from "@/lib/google-calendar";
import { addDays, parseDisplayTime, zonedDateTimeToUtc } from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ZONE = "America/Chicago";
const PUBLIC_BOOKING_WINDOW_DAYS = 30;

export interface Availability {
  allDay: boolean;
  unavailable: string[];
}

export interface BookableSlotResult {
  ok: boolean;
  status: 400 | 409 | 500;
  error: string;
}

interface AvailabilityOptions {
  lessonType?: string;
  busyProvider?: (date: string) => Promise<{ busy: BusyInterval[]; error: string | null }>;
}

export function isValidDateString(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function isPastBookingDate(date: string, now = new Date()): boolean {
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return date <= yesterday.toISOString().split("T")[0];
}

function dateStringInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isWithinPublicBookingWindow(date: string, now = new Date()): boolean {
  const today = dateStringInTimeZone(now, TIME_ZONE);
  const firstBookableDate = addDays(today, 1);
  const lastBookableDate = addDays(today, PUBLIC_BOOKING_WINDOW_DAYS);
  return date >= firstBookableDate && date <= lastBookableDate;
}

function slotOverlapsBusyInterval(
  date: string,
  displayLabel: string,
  lessonType: string | undefined,
  busy: BusyInterval[]
): boolean {
  const parsed = parseDisplayTime(displayLabel);
  if (!parsed) return false;

  const durationMin = LESSON_DURATION_MINUTES[lessonType ?? "beginner"] ?? 60;
  const slotStart = zonedDateTimeToUtc(date, parsed, TIME_ZONE).getTime();
  const slotEnd = slotStart + durationMin * 60_000;
  return busy.some((interval) => {
    const busyStart = interval.start.getTime();
    const busyEnd = interval.end.getTime();
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}

export async function getAvailabilityForDate(
  supabase: SupabaseClient,
  date: string,
  options: AvailabilityOptions = {}
): Promise<{ data: Availability | null; error: string | null }> {
  if (!isValidDateString(date)) {
    return { data: null, error: "Invalid date" };
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);
  const dayOfWeek = parsedDate.getUTCDay();

  const [bookingsResult, blockedResult, recurringResult, timeSlotsResult, busyResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("lesson_time")
      .eq("lesson_date", date)
      .neq("status", "cancelled"),
    supabase
      .from("blocked_slots")
      .select("time, all_day")
      .eq("date", date),
    supabase
      .from("recurring_blocks")
      .select("time")
      .eq("day_of_week", dayOfWeek),
    supabase
      .from("time_slots")
      .select("display_label")
      .eq("active", true),
    (options.busyProvider ?? getGoogleCalendarBusyForDate)(date),
  ]);

  const firstError =
    bookingsResult.error?.message ??
    blockedResult.error?.message ??
    recurringResult.error?.message ??
    timeSlotsResult.error?.message ??
    busyResult.error ??
    null;

  if (firstError) {
    return { data: null, error: firstError };
  }

  let allDay = false;
  const unavailable = new Set<string>();

  bookingsResult.data?.forEach((booking) => {
    if (booking.lesson_time) unavailable.add(booking.lesson_time);
  });
  blockedResult.data?.forEach((block) => {
    if (block.all_day) allDay = true;
    else if (block.time) unavailable.add(block.time);
  });
  recurringResult.data?.forEach((block) => {
    if (block.time === null) allDay = true;
    else if (block.time) unavailable.add(block.time);
  });
  timeSlotsResult.data?.forEach((slot) => {
    if (
      typeof slot.display_label === "string" &&
      slotOverlapsBusyInterval(date, slot.display_label, options.lessonType, busyResult.busy)
    ) {
      unavailable.add(slot.display_label);
    }
  });

  return {
    data: {
      allDay,
      unavailable: Array.from(unavailable),
    },
    error: null,
  };
}

export async function assertBookableSlot(
  supabase: SupabaseClient,
  lessonDate: string,
  lessonTime: string,
  lessonType?: string
): Promise<BookableSlotResult | null> {
  if (!isValidDateString(lessonDate)) {
    return { ok: false, status: 400, error: "Invalid date" };
  }
  if (isPastBookingDate(lessonDate)) {
    return { ok: false, status: 400, error: "Cannot book a date in the past" };
  }
  if (!isWithinPublicBookingWindow(lessonDate)) {
    return { ok: false, status: 400, error: "Bookings are available for the next 30 days." };
  }
  if (typeof lessonTime !== "string" || !lessonTime.trim()) {
    return { ok: false, status: 400, error: "Invalid time" };
  }

  const { data: slot, error: slotError } = await supabase
    .from("time_slots")
    .select("display_label")
    .eq("display_label", lessonTime)
    .eq("active", true)
    .maybeSingle();

  if (slotError) {
    return { ok: false, status: 500, error: "Could not verify lesson time." };
  }
  if (!slot) {
    return { ok: false, status: 400, error: "Invalid time" };
  }

  const availability = await getAvailabilityForDate(supabase, lessonDate, { lessonType });
  if (availability.error || !availability.data) {
    return { ok: false, status: 500, error: "Could not verify availability." };
  }
  if (availability.data.allDay || availability.data.unavailable.includes(lessonTime)) {
    return { ok: false, status: 409, error: "That time slot is not available." };
  }

  return null;
}
