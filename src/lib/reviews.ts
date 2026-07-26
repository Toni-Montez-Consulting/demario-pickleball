import { createHash, randomBytes } from "node:crypto";

/** How long after a lesson before we ask for a review. */
const REVIEW_WINDOW_HOURS = 24;

/** Only a confirmed booking earns a review request. */
const REVIEWABLE_STATUS = "confirmed";

export function generateReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The raw token is emailed to the student and never persisted. Only this hash
 * is stored, using the same salt the IP hasher uses.
 */
export function hashReviewToken(token: string): string {
  const salt =
    process.env.RATE_LIMIT_SALT ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "demario-pickleball";
  return createHash("sha256").update(`${salt}:review:${token}`).digest("hex");
}

/** "Rachel Kim" becomes "Rachel K." — the student can override it on the form. */
export function defaultDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export interface ReviewInput {
  rating: unknown;
  body?: unknown;
  displayName: unknown;
  consent: unknown;
}

export type ReviewValidation =
  | { ok: true; value: { rating: number; body: string | null; displayName: string } }
  | { ok: false; error: string };

/**
 * Server-side validation for every review submission, tokenized or public.
 * Consent is checked first and must be a literal true — the database carries
 * the same rule as a CHECK constraint so a non-consented row cannot exist.
 */
export function validateReviewInput(input: ReviewInput): ReviewValidation {
  if (input.consent !== true) {
    return { ok: false, error: "Consent to publish is required" };
  }
  if (
    typeof input.rating !== "number" ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    return { ok: false, error: "Rating must be a whole number from 1 to 5" };
  }
  if (
    typeof input.displayName !== "string" ||
    !input.displayName.trim() ||
    input.displayName.length > 80
  ) {
    return { ok: false, error: "Invalid display name" };
  }

  let body: string | null = null;
  if (input.body !== undefined && input.body !== null && input.body !== "") {
    if (typeof input.body !== "string" || input.body.length > 2000) {
      return { ok: false, error: "Review is too long" };
    }
    body = input.body.trim() || null;
  }

  return {
    ok: true,
    value: { rating: input.rating, body, displayName: input.displayName.trim() },
  };
}

export interface ReviewEligibleBooking {
  id: string;
  student_id: string | null;
  status: string;
  lesson_date: string;
  lesson_time: string;
  review_request_sent_at: string | null;
}

/**
 * Whether a booking should receive a review request right now.
 *
 * Every exclusion carries a reason so the cron can report what it skipped
 * instead of silently doing nothing.
 */
export function isEligibleForReviewRequest(
  booking: ReviewEligibleBooking,
  now: Date
): { eligible: boolean; reason?: string } {
  if (booking.status !== REVIEWABLE_STATUS) {
    return { eligible: false, reason: `status is ${booking.status}` };
  }
  if (!booking.student_id) {
    return { eligible: false, reason: "no student record" };
  }
  if (booking.review_request_sent_at) {
    return { eligible: false, reason: "already asked" };
  }

  const lessonStart = new Date(`${booking.lesson_date}T00:00:00Z`);
  if (Number.isNaN(lessonStart.getTime())) {
    return { eligible: false, reason: "unparseable lesson date" };
  }

  const hoursSince = (now.getTime() - lessonStart.getTime()) / 3_600_000;
  if (hoursSince < REVIEW_WINDOW_HOURS) {
    return { eligible: false, reason: "lesson is less than 24h old" };
  }

  return { eligible: true };
}
