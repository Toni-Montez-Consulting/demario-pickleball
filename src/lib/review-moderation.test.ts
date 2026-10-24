import { describe, expect, it } from "vitest";
import { signOutcomeToken } from "./lesson-outcomes";
import {
  reviewActionView,
  signReviewActionToken,
  starsText,
  verifyReviewActionToken,
  type ModerationReview,
} from "./review-moderation";

const SECRET = "test-secret-with-enough-entropy";
const REVIEW_ID = "12345678-1234-1234-1234-123456789abc";
const NOW = new Date("2026-10-22T18:00:00Z");

describe("review action links", () => {
  it("round-trips a review id and action", () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: SECRET, now: NOW });
    expect(verifyReviewActionToken(token, SECRET, NOW)).toMatchObject({ ok: true, reviewId: REVIEW_ID, action: "hide" });
  });

  it("rejects a link whose action was swapped from hide to publish", () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: SECRET, now: NOW });
    const [payload, sig] = token.split(".");
    const swapped = Buffer.from(
      Buffer.from(payload, "base64url").toString().replace("hide", "publish")
    ).toString("base64url");
    expect(verifyReviewActionToken(`${swapped}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  // The same secret signs lesson-outcome links, so a domain prefix keeps a
  // valid outcome link from ever passing as a review link.
  it("does not accept a lesson-outcome link", () => {
    const outcome = signOutcomeToken({ bookingId: REVIEW_ID, outcome: "confirmed", secret: SECRET, now: NOW });
    expect(verifyReviewActionToken(outcome, SECRET, NOW).ok).toBe(false);
  });

  it("lasts 60 days", () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "publish", secret: SECRET, now: NOW });
    expect(verifyReviewActionToken(token, SECRET, new Date(NOW.getTime() + 59 * 86_400_000)).ok).toBe(true);
    expect(verifyReviewActionToken(token, SECRET, new Date(NOW.getTime() + 61 * 86_400_000))).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a link signed with another secret, or malformed", () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: "other", now: NOW });
    expect(verifyReviewActionToken(token, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
    for (const bad of ["", "abc", "a.b.c", `${Buffer.from(`${REVIEW_ID}.delete.1800000000`).toString("base64url")}.sig`]) {
      expect(verifyReviewActionToken(bad, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    }
  });
});

describe("reviewActionView", () => {
  const live: ModerationReview = {
    rating: 2,
    body: "Showed up late and talked the whole time.",
    display_name: "Sam P.",
    status: "published",
    verified_booking: true,
  };
  const check = (action: "hide" | "publish") =>
    ({ ok: true, reviewId: REVIEW_ID, action, expiresAt: NOW }) as const;

  it("offers the takedown with the rule written out, whatever the rating", () => {
    const view = reviewActionView({ configured: true, check: check("hide"), review: live });
    expect(view).toMatchObject({
      state: "ready",
      heading: "Take this review down?",
      button: "Take it down",
      review: { rating: 2, stars: "★★☆☆☆", name: "Sam P." },
    });
    expect(view.state === "ready" && view.note).toMatch(/abusive, fake, or says something untrue/);
    expect(view.state === "ready" && view.note).toMatch(/A low rating is not a reason/);
  });

  it("says a review that is already down is down", () => {
    expect(reviewActionView({ configured: true, check: check("hide"), review: { ...live, status: "hidden" } })).toMatchObject({
      state: "done",
      heading: "This review is down",
    });
  });

  it("offers to publish a waiting public review, and says so once it is live", () => {
    const waiting = { ...live, status: "pending", verified_booking: false };
    expect(reviewActionView({ configured: true, check: check("publish"), review: waiting })).toMatchObject({
      state: "ready",
      button: "Publish it",
      review: { source: "From the public review page, so it is not tied to a booking." },
    });
    expect(
      reviewActionView({ configured: true, check: check("publish"), review: { ...waiting, status: "published" } })
    ).toMatchObject({ state: "done", heading: "This review is live" });
  });

  // A publish link must not undo a takedown.
  it("does not offer to publish a review that was taken down", () => {
    expect(
      reviewActionView({ configured: true, check: check("publish"), review: { ...live, status: "hidden" } })
    ).toMatchObject({ state: "done", heading: "This review was taken down" });
  });

  it("explains every way a link can fail", () => {
    expect(reviewActionView({ configured: false, check: null, review: null }).state).toBe("not_configured");
    expect(reviewActionView({ configured: true, check: { ok: false, reason: "expired" }, review: null }).state).toBe("expired");
    expect(reviewActionView({ configured: true, check: { ok: false, reason: "bad_signature" }, review: null }).state).toBe("invalid");
    expect(reviewActionView({ configured: true, check: check("hide"), review: null, loadFailed: true }).state).toBe("unavailable");
    expect(reviewActionView({ configured: true, check: check("hide"), review: null }).state).toBe("missing");
  });

  it("says when the last tap did not save", () => {
    const view = reviewActionView({ configured: true, check: check("hide"), review: live, failed: "save" });
    expect(view.state === "ready" && view.alert).toMatch(/didn't save/);
  });

  it("draws the stars", () => {
    expect(starsText(5)).toBe("★★★★★");
    expect(starsText(1)).toBe("★☆☆☆☆");
  });
});
