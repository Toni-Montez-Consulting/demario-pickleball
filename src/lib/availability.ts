import type { SupabaseClient } from "@supabase/supabase-js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Availability {
  allDay: boolean;
  unavailable: string[];
}

export interface BookableSlotResult {
  ok: boolean;
  status: 400 | 409 | 500;
  error: string;
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

export async function getAvailabilityForDate(
  supabase: SupabaseClient,
  date: string
): Promise<{ data: Availability | null; error: string | null }> {
  if (!isValidDateString(date)) {
    return { data: null, error: "Invalid date" };
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);
  const dayOfWeek = parsedDate.getUTCDay();

  const [bookingsResult, blockedResult, recurringResult] = await Promise.all([
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
  ]);

  const firstError =
    bookingsResult.error?.message ??
    blockedResult.error?.message ??
    recurringResult.error?.message ??
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
  lessonTime: string
): Promise<BookableSlotResult | null> {
  if (!isValidDateString(lessonDate)) {
    return { ok: false, status: 400, error: "Invalid date" };
  }
  if (isPastBookingDate(lessonDate)) {
    return { ok: false, status: 400, error: "Cannot book a date in the past" };
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

  const availability = await getAvailabilityForDate(supabase, lessonDate);
  if (availability.error || !availability.data) {
    return { ok: false, status: 500, error: "Could not verify availability." };
  }
  if (availability.data.allDay || availability.data.unavailable.includes(lessonTime)) {
    return { ok: false, status: 409, error: "That time slot is not available." };
  }

  return null;
}
