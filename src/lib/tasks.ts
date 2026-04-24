export const RECURRENCE_VALUES = ["none", "daily", "weekly", "biweekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCE_VALUES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Doesn't repeat",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s: string): boolean {
  return DATE_RE.test(s);
}

/**
 * Given a YYYY-MM-DD string and a recurrence interval, returns the next
 * occurrence as a YYYY-MM-DD string. Uses UTC math so DST transitions
 * don't shift the date.
 */
export function advanceDueDate(dueDate: string, recurrence: Recurrence): string | null {
  if (recurrence === "none") return null;
  const [y, m, d] = dueDate.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (recurrence === "daily") dt.setUTCDate(dt.getUTCDate() + 1);
  else if (recurrence === "weekly") dt.setUTCDate(dt.getUTCDate() + 7);
  else if (recurrence === "biweekly") dt.setUTCDate(dt.getUTCDate() + 14);
  else if (recurrence === "monthly") dt.setUTCMonth(dt.getUTCMonth() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function todayDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
