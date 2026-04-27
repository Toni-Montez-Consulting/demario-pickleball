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

export function zonedDateTimeToUtc(
  date: string,
  time: DisplayTime,
  timeZone = "America/Chicago"
): Date {
  const [year, month, day] = date.split("-").map((n) => parseInt(n, 10));
  const utcGuess = new Date(Date.UTC(year, month - 1, day, time.hour, time.minute, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

