import { addDays, dateInTimeZone } from "@/lib/time";

/**
 * The day-before reminder a student gets for a lesson booked on the site.
 *
 * Bookings stay "pending" until DeMario records an outcome after the lesson, so
 * pending is the only state a lesson tomorrow can be in. A cancelled booking is
 * never reminded. DeMario sometimes cancels by text without touching the site,
 * which is why the email tells the student to ignore it if plans changed.
 */
export interface ReminderBooking {
  id: string;
  status: string;
  lesson_date: string;
  created_at: string;
  reminder_sent_at: string | null;
}

/**
 * A booking made this close to the lesson just got its confirmation email; a
 * reminder hours later would be noise.
 */
export const RECENT_BOOKING_HOURS = 12;

/** Tomorrow's date (YYYY-MM-DD) in Dallas time. */
export function reminderLessonDate(now: Date): string {
  return addDays(dateInTimeZone(now), 1);
}

export function isDueForReminder(
  booking: ReminderBooking,
  now: Date
): { due: true } | { due: false; reason: string } {
  if (booking.status !== "pending") return { due: false, reason: `status is ${booking.status}` };
  if (booking.reminder_sent_at) return { due: false, reason: "already reminded" };
  if (booking.lesson_date !== reminderLessonDate(now)) return { due: false, reason: "not tomorrow" };
  const created = new Date(booking.created_at).getTime();
  if (Number.isNaN(created)) return { due: false, reason: "unparseable created_at" };
  if (now.getTime() - created < RECENT_BOOKING_HOURS * 3_600_000) {
    return { due: false, reason: "booked in the last 12 hours" };
  }
  return { due: true };
}
