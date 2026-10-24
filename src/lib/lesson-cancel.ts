import { createHmac, timingSafeEqual } from "node:crypto";
import { outcomeSecret, shortName } from "@/lib/lesson-outcomes";
import { lessonName } from "@/lib/lesson-types";
import { SITE_URL } from "@/lib/site";
import { formatLessonDate, lessonHasStarted, parseDisplayTime } from "@/lib/time";

/**
 * One-tap "Cancel this lesson" from DeMario's emails.
 * Design: docs/specs/2026-10-23-one-tap-cancel.md
 *
 * DeMario cancels by text and does not open Admin, so a lesson he called off
 * stayed "pending": the student still got "See you tomorrow", and the time
 * stayed blocked on the site. His booking email and his day-before email now
 * carry this link. Like the outcome links, it opens a confirmation page, and
 * only that page's button changes anything, because mail scanners fetch every
 * link in an email. Cancelling does what Admin's Cancel does: the booking
 * becomes "cancelled" and the student gets the cancellation email.
 *
 * Signed with the outcome links' secret, kept apart by a domain prefix.
 */

// Long enough to cover any lesson the site lets someone book (30 days ahead).
const TOKEN_TTL_SECONDS = 45 * 24 * 60 * 60;
const DOMAIN = "lesson-cancel:v1:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mac(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(DOMAIN + payload).digest();
}

export function signCancelToken({
  bookingId,
  secret,
  now = new Date(),
  ttlSeconds = TOKEN_TTL_SECONDS,
}: {
  bookingId: string;
  secret: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const expires = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const payload = `${bookingId}.cancel.${expires}`;
  return `${Buffer.from(payload).toString("base64url")}.${mac(payload, secret).toString("base64url")}`;
}

export type CancelCheck =
  | { ok: true; bookingId: string; expiresAt: Date }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyCancelToken(token: string, secret: string, now = new Date()): CancelCheck {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };

  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  const [bookingId, action, expiresRaw, ...rest] = payload.split(".");
  if (rest.length > 0 || !UUID_RE.test(bookingId ?? "") || action !== "cancel" || !/^\d{9,11}$/.test(expiresRaw ?? "")) {
    return { ok: false, reason: "malformed" };
  }

  const given = Buffer.from(parts[1], "base64url");
  const expected = mac(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  const expiresAt = new Date(Number(expiresRaw) * 1000);
  if (expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  return { ok: true, bookingId, expiresAt };
}

/** The emailed link for one booking, or null when one-tap links are not set up. */
export function cancelLessonUrl(bookingId: string, now = new Date()): string | null {
  const secret = outcomeSecret();
  if (!secret) return null;
  return `${SITE_URL}/cancel-lesson/${signCancelToken({ bookingId, secret, now })}`;
}

/** What the confirmation page needs to know about the booking. */
export interface CancelBooking {
  name: string;
  status: string;
  lesson_type: string;
  lesson_date: string;
  lesson_time: string;
}

export type CancelFailure = "save" | "busy";

const FAILURE_ALERTS: Record<CancelFailure, string> = {
  save: "That didn't save, and nothing was changed. Try the button again.",
  busy: "Too many tries in the last hour, and nothing was changed. Try again later.",
};

export type CancelView =
  | {
      state: "ready";
      heading: string;
      lesson: { student: string; name: string; when: string };
      note: string;
      alert?: string;
    }
  | {
      state:
        | "done"
        | "started"
        | "unreadable"
        | "settled"
        | "expired"
        | "invalid"
        | "missing"
        | "unavailable"
        | "not_configured";
      heading: string;
      body: string;
    };

/**
 * Everything the confirmation page shows, decided from the link check and the
 * booking's current state. Pure, so every state is unit tested.
 */
export function cancelView({
  configured,
  check,
  booking,
  loadFailed = false,
  failed = null,
  now = new Date(),
}: {
  configured: boolean;
  check: CancelCheck | null;
  booking: CancelBooking | null;
  loadFailed?: boolean;
  failed?: CancelFailure | null;
  now?: Date;
}): CancelView {
  if (!configured) {
    return {
      state: "not_configured",
      heading: "One-tap links aren't set up yet",
      body: "Nothing was changed. Cancel this lesson in Admin.",
    };
  }
  if (!check || !check.ok) {
    if (check?.reason === "expired") {
      return {
        state: "expired",
        heading: "This link has expired",
        body: "Nothing was changed. Cancel the lesson in Admin if it is still on.",
      };
    }
    return {
      state: "invalid",
      heading: "This link isn't valid",
      body: "Nothing was changed. Open the button from the email again, or use Admin.",
    };
  }
  if (loadFailed) {
    return {
      state: "unavailable",
      heading: "The lesson couldn't be loaded",
      body: "Nothing was changed. Try the link again in a minute, or use Admin.",
    };
  }
  if (!booking) {
    return {
      state: "missing",
      heading: "This lesson isn't on the site anymore",
      body: "Nothing was changed. It may have been deleted in Admin.",
    };
  }
  if (booking.status === "cancelled") {
    return {
      state: "done",
      heading: "This lesson is cancelled",
      body: "The time is open again on your site. A lesson cancelled here or in Admin before it started also emailed the student.",
    };
  }
  if (booking.status !== "pending") {
    return {
      state: "settled",
      heading: "This lesson already has an outcome",
      body: "It was marked as happened or a no-show, so there is nothing to cancel. Change it in Admin if that was a mistake.",
    };
  }
  // Without a readable start time there is no telling whether the lesson has
  // happened, and cancelling one that has would email the student about a
  // lesson they already had. Refuse rather than guess.
  if (!parseDisplayTime(booking.lesson_time)) {
    return {
      state: "unreadable",
      heading: "This lesson's time can't be read",
      body: "Nothing was changed. Cancel it in Admin if it is still on.",
    };
  }
  if (lessonHasStarted(booking.lesson_date, booking.lesson_time, now)) {
    return {
      state: "started",
      heading: "This lesson has already started",
      body: "It can't be cancelled from here. If it didn't happen, tap Didn't happen in the next morning's email.",
    };
  }

  const student = shortName(booking.name);
  return {
    state: "ready",
    heading: `Cancel ${student}'s lesson?`,
    lesson: {
      student,
      name: lessonName(booking.lesson_type),
      when: `${formatLessonDate(booking.lesson_date)} · ${booking.lesson_time} CT`,
    },
    note: `This emails ${student} that the lesson is cancelled and opens the time on your site again. If you added it to your Google Calendar, delete it there too, or the site keeps that time blocked. Settle any payment with them directly.`,
    ...(failed ? { alert: FAILURE_ALERTS[failed] } : {}),
  };
}
