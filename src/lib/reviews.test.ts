import { describe, it, expect } from "vitest";
import {
  generateReviewToken,
  hashReviewToken,
  validateReviewInput,
  isEligibleForReviewRequest,
  defaultDisplayName,
} from "./reviews";

describe("review tokens", () => {
  it("generates distinct urlsafe tokens", () => {
    const a = generateReviewToken();
    const b = generateReviewToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });
  it("hashes deterministically and does not return the raw token", () => {
    const t = generateReviewToken();
    expect(hashReviewToken(t)).toBe(hashReviewToken(t));
    expect(hashReviewToken(t)).not.toBe(t);
  });
  it("hashes different tokens differently", () => {
    expect(hashReviewToken(generateReviewToken())).not.toBe(
      hashReviewToken(generateReviewToken())
    );
  });
});

describe("defaultDisplayName", () => {
  it("renders first name plus last initial", () => {
    expect(defaultDisplayName("Rachel Kim")).toBe("Rachel K.");
  });
  it("uses the last word for a three-part name", () => {
    expect(defaultDisplayName("Ana Maria Lopez")).toBe("Ana L.");
  });
  it("passes through a single name", () => {
    expect(defaultDisplayName("Rachel")).toBe("Rachel");
  });
  it("survives empty input", () => {
    expect(defaultDisplayName("   ")).toBe("");
  });
});

describe("validateReviewInput", () => {
  it("accepts a valid submission", () => {
    const r = validateReviewInput({
      rating: 5,
      body: "Great lesson",
      displayName: "Rachel K.",
      consent: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.rating).toBe(5);
  });
  it("accepts an empty body", () => {
    const r = validateReviewInput({ rating: 4, body: "", displayName: "Rachel K.", consent: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBeNull();
  });
  it("trims the body and the display name", () => {
    const r = validateReviewInput({
      rating: 4,
      body: "  solid  ",
      displayName: "  Rachel K.  ",
      consent: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.body).toBe("solid");
      expect(r.value.displayName).toBe("Rachel K.");
    }
  });
  it("rejects a missing or false consent", () => {
    expect(validateReviewInput({ rating: 5, displayName: "R", consent: false }).ok).toBe(false);
    expect(validateReviewInput({ rating: 5, displayName: "R", consent: undefined }).ok).toBe(false);
    expect(validateReviewInput({ rating: 5, displayName: "R", consent: "true" }).ok).toBe(false);
  });
  it("rejects an out-of-range or non-integer rating", () => {
    expect(validateReviewInput({ rating: 0, displayName: "R", consent: true }).ok).toBe(false);
    expect(validateReviewInput({ rating: 6, displayName: "R", consent: true }).ok).toBe(false);
    expect(validateReviewInput({ rating: 4.5, displayName: "R", consent: true }).ok).toBe(false);
    expect(validateReviewInput({ rating: "5", displayName: "R", consent: true }).ok).toBe(false);
  });
  it("rejects an empty display name and an overlong body", () => {
    expect(validateReviewInput({ rating: 5, displayName: "   ", consent: true }).ok).toBe(false);
    expect(
      validateReviewInput({ rating: 5, body: "x".repeat(2001), displayName: "R", consent: true }).ok
    ).toBe(false);
  });
});

describe("isEligibleForReviewRequest", () => {
  const now = new Date("2026-07-25T18:00:00Z");
  const base = {
    id: "b1",
    student_id: "s1",
    status: "confirmed",
    lesson_date: "2026-07-23",
    lesson_time: "10:00 AM",
    review_request_sent_at: null,
  };

  it("is eligible more than 24h after the lesson", () => {
    expect(isEligibleForReviewRequest(base, now).eligible).toBe(true);
  });
  it("is not eligible within 24h of the lesson", () => {
    expect(isEligibleForReviewRequest({ ...base, lesson_date: "2026-07-25" }, now).eligible).toBe(
      false
    );
  });
  it("is not eligible for a future lesson", () => {
    expect(isEligibleForReviewRequest({ ...base, lesson_date: "2026-08-01" }, now).eligible).toBe(
      false
    );
  });
  it("excludes cancelled and no_show bookings", () => {
    expect(isEligibleForReviewRequest({ ...base, status: "cancelled" }, now).eligible).toBe(false);
    expect(isEligibleForReviewRequest({ ...base, status: "no_show" }, now).eligible).toBe(false);
    expect(isEligibleForReviewRequest({ ...base, status: "pending" }, now).eligible).toBe(false);
  });
  it("excludes a booking already asked", () => {
    expect(
      isEligibleForReviewRequest({ ...base, review_request_sent_at: "2026-07-24T00:00:00Z" }, now)
        .eligible
    ).toBe(false);
  });
  it("excludes a booking with no student", () => {
    expect(isEligibleForReviewRequest({ ...base, student_id: null }, now).eligible).toBe(false);
  });
  it("gives a reason for every exclusion", () => {
    expect(isEligibleForReviewRequest({ ...base, status: "cancelled" }, now).reason).toBeTruthy();
    expect(isEligibleForReviewRequest({ ...base, student_id: null }, now).reason).toBeTruthy();
    expect(
      isEligibleForReviewRequest({ ...base, lesson_date: "2026-07-25" }, now).reason
    ).toBeTruthy();
  });
});
