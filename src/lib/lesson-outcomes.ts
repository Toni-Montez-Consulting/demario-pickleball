import { createHmac, timingSafeEqual } from "node:crypto";
import { addDays, dateInTimeZone } from "@/lib/time";

/**
 * One-tap lesson outcomes from Mario's morning email.
 * Design: docs/specs/2026-10-19-lesson-outcome-nudge.md
 *
 * A link names one booking and one outcome, expires, and can only move a
 * booking out of `pending`. It opens a confirmation page; only that page's
 * POST records anything, because mail scanners fetch every link in an email.
 */

export const OUTCOMES = ["confirmed", "no_show", "cancelled"] as const;
export type LessonOutcome = (typeof OUTCOMES)[number];

/** What each booking status means once the lesson date has passed. */
export const OUTCOME_LABELS: Record<LessonOutcome, string> = {
  confirmed: "Lesson happened",
  no_show: "No-show",
  cancelled: "Didn't happen",
};

/** Lessons dated this many days back (and no older) appear in the digest. */
export const REMINDER_DAYS = 3;

const TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;
// Keeps a MAC made here from being valid for any other use of the secret.
const DOMAIN = "lesson-outcome:v1:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function outcomeSecret(): string | null {
  const secret = process.env.LESSON_OUTCOME_SECRET?.trim();
  return secret ? secret : null;
}

function mac(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(DOMAIN + payload).digest();
}

export function signOutcomeToken({
  bookingId,
  outcome,
  secret,
  now = new Date(),
  ttlSeconds = TOKEN_TTL_SECONDS,
}: {
  bookingId: string;
  outcome: LessonOutcome;
  secret: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const expires = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const payload = `${bookingId}.${outcome}.${expires}`;
  return `${Buffer.from(payload).toString("base64url")}.${mac(payload, secret).toString("base64url")}`;
}

export type TokenCheck =
  | { ok: true; bookingId: string; outcome: LessonOutcome; expiresAt: Date }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyOutcomeToken(token: string, secret: string, now = new Date()): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };

  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  const [bookingId, outcome, expiresRaw, ...rest] = payload.split(".");
  if (
    rest.length > 0 ||
    !UUID_RE.test(bookingId ?? "") ||
    !OUTCOMES.includes(outcome as LessonOutcome) ||
    !/^\d{9,11}$/.test(expiresRaw ?? "")
  ) {
    return { ok: false, reason: "malformed" };
  }

  const given = Buffer.from(parts[1], "base64url");
  const expected = mac(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  const expiresAt = new Date(Number(expiresRaw) * 1000);
  if (expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  return { ok: true, bookingId, outcome: outcome as LessonOutcome, expiresAt };
}

/** Lesson dates (Central) that belong in this morning's digest, inclusive. */
export function reminderWindow(now: Date): { from: string; to: string } {
  const today = dateInTimeZone(now);
  return { from: addDays(today, -REMINDER_DAYS), to: addDays(today, -1) };
}

/** "Sat, Oct 18" for a YYYY-MM-DD lesson date. */
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

/** "Jane S." — the most the public confirmation page shows of a student. */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Your student";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

const ACTION_COPY: Record<LessonOutcome, { question: (name: string) => string; button: string }> = {
  confirmed: { question: (n) => `Did ${n}'s lesson happen?`, button: "Yes, the lesson happened" },
  no_show: { question: (n) => `Was ${n} a no-show?`, button: "Mark as no-show" },
  cancelled: { question: (n) => `Did ${n}'s lesson not happen?`, button: "Mark as didn't happen" },
};

const STATUS_LABELS: Record<string, string> = {
  ...OUTCOME_LABELS,
  pending: "Not recorded yet",
};

export interface OutcomeBooking {
  name: string;
  lesson_type: string;
  lesson_date: string;
  lesson_time: string;
  status: string;
}

export type OutcomeView =
  | {
      state: "pending";
      heading: string;
      button: string;
      facts: Array<{ label: string; value: string }>;
      note: string;
    }
  | {
      state: "recorded" | "expired" | "invalid" | "missing" | "unavailable" | "not_configured";
      heading: string;
      body: string;
    };

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

/**
 * Everything the confirmation page shows, decided from the token check and
 * the booking's current status. Pure, so every state is unit tested; the page
 * only renders it.
 */
export function outcomeView({
  configured,
  check,
  booking,
  loadFailed = false,
}: {
  configured: boolean;
  check: TokenCheck | null;
  booking: OutcomeBooking | null;
  /** The booking lookup errored, which is not the same as the booking being gone. */
  loadFailed?: boolean;
}): OutcomeView {
  if (!configured || !check) {
    return {
      state: "not_configured",
      heading: "Lesson outcome links aren't set up yet",
      body: "Record this lesson in Admin for now.",
    };
  }
  if (!check.ok) {
    return check.reason === "expired"
      ? {
          state: "expired",
          heading: "This link has expired",
          body: "Outcome links last 14 days. Record this lesson in Admin.",
        }
      : {
          state: "invalid",
          heading: "This link isn't valid",
          body: "It may have been copied incompletely. Record this lesson in Admin.",
        };
  }
  if (loadFailed) {
    return {
      state: "unavailable",
      heading: "Couldn't load this lesson",
      body: "Nothing was changed. Try the link again in a minute, or use Admin.",
    };
  }
  if (!booking) {
    return {
      state: "missing",
      heading: "That booking no longer exists",
      body: "It may have been deleted in Admin. Nothing else needs doing.",
    };
  }

  const name = shortName(booking.name);
  if (booking.status !== "pending") {
    const label = STATUS_LABELS[booking.status] ?? booking.status;
    return {
      state: "recorded",
      heading: `Recorded: ${label.toLowerCase()}`,
      body:
        booking.status === "confirmed"
          ? `The site can now ask ${name} for a review. You can change this in Admin.`
          : `Nothing is sent to ${name}. You can change this in Admin.`,
    };
  }

  const copy = ACTION_COPY[check.outcome];
  return {
    state: "pending",
    heading: copy.question(name),
    button: copy.button,
    facts: [
      { label: "Lesson", value: LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type },
      { label: "When", value: `${formatLessonDate(booking.lesson_date)} · ${booking.lesson_time} CT` },
    ],
    note:
      check.outcome === "confirmed"
        ? `Recording this lets the site ask ${name} for a review.`
        : `Nothing is sent to ${name}.`,
  };
}
