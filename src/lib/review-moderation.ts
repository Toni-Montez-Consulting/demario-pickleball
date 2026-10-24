import { createHmac, timingSafeEqual } from "node:crypto";
import { outcomeSecret } from "@/lib/lesson-outcomes";

/**
 * One-tap review moderation from DeMario's email.
 * Design: docs/specs/2026-10-22-automatic-reviews.md
 *
 * A verified review (the emailed link, tied to a real lesson) goes live the
 * moment the student submits it, at any star rating. DeMario's email about it
 * carries a "Take it down" link for a review that is abusive, fake, or untrue.
 * A public review (the /review page, which anyone can open) waits, and its
 * email carries a "Publish" link.
 *
 * As with the lesson-outcome links, a link only opens a confirmation page.
 * Only that page's button changes anything, because mail scanners fetch every
 * link in an email. The signing secret is the outcome links' secret, kept
 * apart from them by a domain prefix, so one link can never be read as the other.
 */

export const REVIEW_ACTIONS = ["hide", "publish"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

// A nefarious review can surface long after it was posted, so the takedown
// link lasts two months. Admin can always hide a review.
const TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;
const DOMAIN = "review-moderation:v1:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One signing secret for all of DeMario's one-tap links. */
export function moderationSecret(): string | null {
  return outcomeSecret();
}

function mac(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(DOMAIN + payload).digest();
}

export function signReviewActionToken({
  reviewId,
  action,
  secret,
  now = new Date(),
  ttlSeconds = TOKEN_TTL_SECONDS,
}: {
  reviewId: string;
  action: ReviewAction;
  secret: string;
  now?: Date;
  ttlSeconds?: number;
}): string {
  const expires = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const payload = `${reviewId}.${action}.${expires}`;
  return `${Buffer.from(payload).toString("base64url")}.${mac(payload, secret).toString("base64url")}`;
}

export type ReviewActionCheck =
  | { ok: true; reviewId: string; action: ReviewAction; expiresAt: Date }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyReviewActionToken(token: string, secret: string, now = new Date()): ReviewActionCheck {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };

  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  const [reviewId, action, expiresRaw, ...rest] = payload.split(".");
  if (
    rest.length > 0 ||
    !UUID_RE.test(reviewId ?? "") ||
    !REVIEW_ACTIONS.includes(action as ReviewAction) ||
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

  return { ok: true, reviewId, action: action as ReviewAction, expiresAt };
}

/** What a review looks like to the moderation page. */
export interface ModerationReview {
  rating: number;
  body: string | null;
  display_name: string;
  status: string;
  verified_booking: boolean;
}

/** Why the last tap did not save, from the endpoint's ?failed= redirect. */
export type ReviewActionFailure = "save" | "busy";

const FAILURE_ALERTS: Record<ReviewActionFailure, string> = {
  save: "That didn't save, and nothing was changed. Try the button again.",
  busy: "Too many tries in the last hour, and nothing was changed. Try again later.",
};

export type ReviewActionView =
  | {
      state: "ready";
      heading: string;
      button: string;
      review: { rating: number; stars: string; name: string; body: string | null; source: string };
      note: string;
      alert?: string;
    }
  | {
      state: "done" | "expired" | "invalid" | "missing" | "unavailable" | "not_configured";
      heading: string;
      body: string;
    };

export function starsText(rating: number): string {
  const whole = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(whole) + "☆".repeat(5 - whole);
}

/**
 * Everything the confirmation page shows, decided from the link check and the
 * review's current status. Pure, so every state is unit tested.
 */
export function reviewActionView({
  configured,
  check,
  review,
  loadFailed = false,
  failed = null,
}: {
  configured: boolean;
  check: ReviewActionCheck | null;
  review: ModerationReview | null;
  loadFailed?: boolean;
  failed?: ReviewActionFailure | null;
}): ReviewActionView {
  if (!configured || !check) {
    return {
      state: "not_configured",
      heading: "Review links aren't set up yet",
      body: "Use Admin, then Reviews, for now.",
    };
  }
  if (!check.ok) {
    return check.reason === "expired"
      ? { state: "expired", heading: "This link has expired", body: "Review links last 60 days. Use Admin, then Reviews." }
      : {
          state: "invalid",
          heading: "This link isn't valid",
          body: "It may have been copied incompletely. Use Admin, then Reviews.",
        };
  }
  if (loadFailed) {
    return {
      state: "unavailable",
      heading: "Couldn't load this review",
      body: "Nothing was changed. Try the link again in a minute, or use Admin.",
    };
  }
  if (!review) {
    return { state: "missing", heading: "That review no longer exists", body: "Nothing else needs doing." };
  }

  if (check.action === "hide" && review.status === "hidden") {
    return {
      state: "done",
      heading: "This review is down",
      body: "It no longer shows on the site. You can put it back up in Admin, then Reviews.",
    };
  }
  if (check.action === "publish" && review.status === "published") {
    return { state: "done", heading: "This review is live", body: "It shows on the site now." };
  }
  if (check.action === "publish" && review.status === "hidden") {
    return {
      state: "done",
      heading: "This review was taken down",
      body: "Publish it from Admin, then Reviews, if you change your mind.",
    };
  }

  const shown = {
    rating: review.rating,
    stars: starsText(review.rating),
    name: review.display_name,
    body: review.body,
    source: review.verified_booking
      ? "From the review link sent after a lesson booked on the site."
      : "From the public review page, so it is not tied to a booking.",
  };
  const alert = failed ? { alert: FAILURE_ALERTS[failed] } : {};

  return check.action === "hide"
    ? {
        state: "ready",
        heading: "Take this review down?",
        button: "Take it down",
        review: shown,
        note:
          "Take a review down only if it is abusive, fake, or says something untrue. A low rating " +
          "is not a reason: hiding honest reviews for their rating can break the federal rule on " +
          "reviews. You can put it back up in Admin.",
        ...alert,
      }
    : {
        state: "ready",
        heading: "Publish this review?",
        button: "Publish it",
        review: shown,
        note:
          "Publish it if it is from someone you have coached. Leave it if it is spam, fake, or abusive; " +
          "it stays off the site.",
        ...alert,
      };
}
