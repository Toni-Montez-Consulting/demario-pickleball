import { SITE_URL } from "@/lib/site";
import { LESSON_DURATION_MINUTES, LESSON_LOCATION } from "@/lib/business";
import { parseDisplayTime } from "@/lib/time";

export type IcsMethod = "REQUEST" | "CANCEL";

export interface IcsBooking {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  lesson_type: string;
  lesson_date: string;
  lesson_time: string;
  notes?: string | null;
}

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

function formatLocal(year: number, month: number, day: number, hour: number, minute: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`;
}

function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(" " + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

/**
 * Builds a minimal America/Chicago VTIMEZONE block. Only uses US rules for
 * current decade — sufficient for student calendars.
 */
const CHICAGO_TZ_BLOCK = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Chicago",
  "BEGIN:STANDARD",
  "DTSTART:20071104T020000",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:20070311T020000",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

export function generateGoogleCalendarUrl({
  booking,
  organizerName = "DeMario Montez",
}: {
  booking: IcsBooking;
  organizerName?: string;
}): string {
  const [y, mo, d] = booking.lesson_date.split("-").map((n) => parseInt(n, 10));
  const parsed = parseDisplayTime(booking.lesson_time);
  const start = parsed ?? { hour: 9, minute: 0 };
  const durationMin = LESSON_DURATION_MINUTES[booking.lesson_type] ?? 60;
  const endTotal = start.hour * 60 + start.minute + durationMin;
  const dtStart = formatLocal(y, mo, d, start.hour, start.minute);
  const dtEnd = formatLocal(y, mo, d, Math.floor(endTotal / 60), endTotal % 60);
  const lessonName = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Pickleball lesson — ${lessonName} with ${organizerName}`,
    dates: `${dtStart}/${dtEnd}`,
    ctz: "America/Chicago",
    details: `Booking ID: ${booking.id.slice(0, 8).toUpperCase()}\nCourt: Mario will confirm the exact court after booking.\nPay: ${SITE_URL}/pay`,
    location: LESSON_LOCATION,
    sf: "true",
    output: "xml",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateIcs({
  booking,
  method,
  organizerEmail,
  organizerName = "DeMario Montez",
}: {
  booking: IcsBooking;
  method: IcsMethod;
  organizerEmail: string;
  organizerName?: string;
}): { ics: string; filename: string } {
  const [y, mo, d] = booking.lesson_date.split("-").map((n) => parseInt(n, 10));
  const parsed = parseDisplayTime(booking.lesson_time);
  const start = parsed ?? { hour: 9, minute: 0 };
  const durationMin = LESSON_DURATION_MINUTES[booking.lesson_type] ?? 60;
  const endMinutesTotal = start.hour * 60 + start.minute + durationMin;
  const endHour = Math.floor(endMinutesTotal / 60);
  const endMinute = endMinutesTotal % 60;

  const dtStart = formatLocal(y, mo, d, start.hour, start.minute);
  const dtEnd = formatLocal(y, mo, d, endHour, endMinute);
  const dtStamp = formatUtc(new Date());

  const lessonName = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;
  const summary =
    method === "CANCEL"
      ? `Cancelled: Pickleball lesson (${lessonName})`
      : `Pickleball lesson — ${lessonName} with DeMario`;

  const description = [
    `Lesson: ${lessonName}`,
    `Coach: ${organizerName}`,
    `Court: Mario will confirm the exact court after booking.`,
    ``,
    `Booking ID: ${booking.id.slice(0, 8).toUpperCase()}`,
    `Pay: ${SITE_URL}/pay (include booking ID in memo)`,
  ].join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DeMario Montez Pickleball//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    ...CHICAGO_TZ_BLOCK,
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@demariomontezpb.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=America/Chicago:${dtStart}`,
    `DTEND;TZID=America/Chicago:${dtEnd}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(LESSON_LOCATION)}`,
    `ORGANIZER;CN=${escapeIcs(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escapeIcs(booking.name)};RSVP=FALSE:mailto:${booking.email}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${method === "CANCEL" ? 1 : 0}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const ics = lines.map(foldLine).join("\r\n") + "\r\n";
  const filename = method === "CANCEL" ? "cancellation.ics" : "invite.ics";
  return { ics, filename };
}
