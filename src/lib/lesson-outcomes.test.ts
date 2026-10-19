import { describe, expect, it } from "vitest";
import {
  formatLessonDate,
  outcomeView,
  reminderWindow,
  shortName,
  signOutcomeToken,
  verifyOutcomeToken,
  type OutcomeBooking,
} from "./lesson-outcomes";

const SECRET = "test-secret-with-enough-entropy";
const BOOKING_ID = "12345678-1234-1234-1234-123456789abc";
const NOW = new Date("2026-10-19T13:00:00Z");

describe("outcome tokens", () => {
  it("round-trips a booking id and outcome", () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "no_show", secret: SECRET, now: NOW });
    const check = verifyOutcomeToken(token, SECRET, NOW);
    expect(check).toMatchObject({ ok: true, bookingId: BOOKING_ID, outcome: "no_show" });
  });

  it("rejects a token signed with another secret", () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "confirmed", secret: "other", now: NOW });
    expect(verifyOutcomeToken(token, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token whose outcome was swapped", () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "no_show", secret: SECRET, now: NOW });
    const [payload, sig] = token.split(".");
    const swapped = Buffer.from(
      Buffer.from(payload, "base64url").toString().replace("no_show", "confirmed")
    ).toString("base64url");
    expect(verifyOutcomeToken(`${swapped}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a tampered signature", () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "confirmed", secret: SECRET, now: NOW });
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(verifyOutcomeToken(tampered, SECRET, NOW)).toMatchObject({ ok: false });
  });

  it("expires after 14 days", () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "confirmed", secret: SECRET, now: NOW });
    const day13 = new Date(NOW.getTime() + 13 * 86_400_000);
    const day15 = new Date(NOW.getTime() + 15 * 86_400_000);
    expect(verifyOutcomeToken(token, SECRET, day13).ok).toBe(true);
    expect(verifyOutcomeToken(token, SECRET, day15)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects malformed input before checking a signature", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "x.", `${Buffer.from("not-a-uuid.confirmed.1800000000").toString("base64url")}.sig`, `${Buffer.from(`${BOOKING_ID}.paid.1800000000`).toString("base64url")}.sig`]) {
      expect(verifyOutcomeToken(bad, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    }
  });
});

describe("reminderWindow", () => {
  it("covers the three Central days before today", () => {
    // 13:00 UTC on Oct 19 is 8:00 AM Oct 19 in Dallas.
    expect(reminderWindow(NOW)).toEqual({ from: "2026-10-16", to: "2026-10-18" });
  });

  it("uses the Central date even when UTC has rolled over", () => {
    // 03:00 UTC on Oct 20 is still the evening of Oct 19 in Dallas.
    expect(reminderWindow(new Date("2026-10-20T03:00:00Z"))).toEqual({ from: "2026-10-16", to: "2026-10-18" });
  });
});

describe("display helpers", () => {
  it("formats a lesson date without drifting a day", () => {
    expect(formatLessonDate("2026-10-18")).toBe("Sun, Oct 18");
  });

  it("shows only a first name and last initial", () => {
    expect(shortName("Jane Q Student")).toBe("Jane S.");
    expect(shortName("Cher")).toBe("Cher");
    expect(shortName("  ")).toBe("Your student");
  });
});

describe("outcomeView", () => {
  const booking: OutcomeBooking = {
    name: "Jane Student",
    lesson_type: "beginner",
    lesson_date: "2026-10-18",
    lesson_time: "9:00 AM",
    status: "pending",
  };
  const valid = (outcome: "confirmed" | "no_show" | "cancelled") =>
    ({ ok: true, bookingId: BOOKING_ID, outcome, expiresAt: NOW }) as const;

  it("asks the question for the link's outcome on a pending booking", () => {
    const view = outcomeView({ configured: true, check: valid("confirmed"), booking });
    expect(view).toMatchObject({
      state: "pending",
      heading: "Did Jane S.'s lesson happen?",
      button: "Yes, the lesson happened",
      facts: [
        { label: "Lesson", value: "Foundations" },
        { label: "When", value: "Sun, Oct 18 · 9:00 AM CT" },
      ],
    });
    expect(JSON.stringify(view)).not.toContain("Student");
  });

  it("uses no-show wording for a no-show link", () => {
    expect(outcomeView({ configured: true, check: valid("no_show"), booking })).toMatchObject({
      heading: "Was Jane S. a no-show?",
      button: "Mark as no-show",
    });
  });

  it("reports what is already recorded instead of offering a change", () => {
    const view = outcomeView({ configured: true, check: valid("no_show"), booking: { ...booking, status: "confirmed" } });
    expect(view).toMatchObject({ state: "recorded", heading: "Recorded: lesson happened" });
  });

  it("covers the error states", () => {
    expect(outcomeView({ configured: false, check: null, booking: null }).state).toBe("not_configured");
    expect(outcomeView({ configured: true, check: { ok: false, reason: "expired" }, booking: null }).state).toBe("expired");
    expect(outcomeView({ configured: true, check: { ok: false, reason: "bad_signature" }, booking: null }).state).toBe("invalid");
    expect(outcomeView({ configured: true, check: valid("confirmed"), booking: null }).state).toBe("missing");
  });

  it("does not claim a booking is gone when the lookup itself failed", () => {
    const view = outcomeView({ configured: true, check: valid("confirmed"), booking: null, loadFailed: true });
    expect(view).toMatchObject({ state: "unavailable", heading: "Couldn't load this lesson" });
  });
});
