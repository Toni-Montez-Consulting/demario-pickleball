export interface DisplayTime {
  hour: number;
  minute: number;
}

export function parseDisplayTime(display: string): DisplayTime | null {
  const m = display.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const mer = m[3].toUpperCase();
  if (hour === 12) hour = 0;
  if (mer === "PM") hour += 12;
  return { hour, minute };
}

/** The calendar date (YYYY-MM-DD) at `date` in the given time zone. */
export function dateInTimeZone(date: Date, timeZone = "America/Chicago"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** "Sat, Oct 18" for a YYYY-MM-DD lesson date; the date itself if it does not parse. */
export function formatLessonDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) => {
    const part = parts.find((p) => p.type === type)?.value;
    return part ? parseInt(part, 10) : 0;
  };

  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );
  return asUtc - date.getTime();
}

/**
 * Whether a lesson's start, in the booking time zone, has passed. A time that
 * does not parse counts as not started, which keeps the old behaviour.
 */
export function lessonHasStarted(
  date: string,
  time: string,
  now = new Date(),
  timeZone = "America/Chicago"
): boolean {
  const parsed = parseDisplayTime(time);
  if (!parsed) return false;
  return zonedDateTimeToUtc(date, parsed, timeZone).getTime() <= now.getTime();
}

export function zonedDateTimeToUtc(
  date: string,
  time: DisplayTime,
  timeZone = "America/Chicago"
): Date {
  const [year, month, day] = date.split("-").map((n) => parseInt(n, 10));
  const wallClock = Date.UTC(year, month - 1, day, time.hour, time.minute, 0);
  // The offset depends on the instant being solved for. The first guess reads
  // it at the wall-clock time taken as UTC, which on the two daylight-saving
  // Sundays can fall on the other side of the switch: 7:00 AM on 2027-03-14
  // came out as 8:00 AM. Reading the offset again at the first answer fixes it.
  const first = wallClock - getTimeZoneOffsetMs(new Date(wallClock), timeZone);
  return new Date(wallClock - getTimeZoneOffsetMs(new Date(first), timeZone));
}

