import { afterEach, describe, expect, it, vi } from "vitest";
import { signOutcomeToken } from "./lesson-outcomes";
import { cancelLessonUrl, cancelView, signCancelToken, verifyCancelToken, type CancelBooking } from "./lesson-cancel";

const SIGNER = "fake-signing-value-for-tests";
const BOOKING_ID = "11111111-1111-1111-1111-111111111111";
// 10:00 AM in Dallas on Friday, Oct 23, 2026.
const NOW = new Date("2026-10-23T15:00:00Z");

const pending: CancelBooking = {
  name: "Jane Student",
  status: "pending",
  lesson_type: "beginner",
  lesson_date: "2026-10-24",
  lesson_time: "9:00 AM",
};

describe("cancel tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips one booking", () => {
    const token = signCancelToken({ bookingId: BOOKING_ID, secret: SIGNER, now: NOW });
    expect(verifyCancelToken(token, SIGNER, NOW)).toMatchObject({ ok: true, bookingId: BOOKING_ID });
  });

  it("rejects another secret, an edited payload, and an expired link", () => {
    const token = signCancelToken({ bookingId: BOOKING_ID, secret: SIGNER, now: NOW, ttlSeconds: 60 });
    expect(verifyCancelToken(token, "another-value", NOW)).toMatchObject({ ok: false, reason: "bad_signature" });

    const [, sig] = token.split(".");
    const edited = Buffer.from(`22222222-2222-2222-2222-222222222222.cancel.${Math.floor(NOW.getTime() / 1000) + 60}`).toString("base64url");
    expect(verifyCancelToken(`${edited}.${sig}`, SIGNER, NOW)).toMatchObject({ ok: false, reason: "bad_signature" });

    expect(verifyCancelToken(token, SIGNER, new Date(NOW.getTime() + 61_000))).toMatchObject({
      ok: false,
      reason: "expired",
    });
    expect(verifyCancelToken("not-a-token", SIGNER, NOW)).toMatchObject({ ok: false, reason: "malformed" });
  });

  it("never accepts a lesson-outcome link as a cancel link", () => {
    const outcome = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "cancelled", secret: SIGNER, now: NOW });
    expect(verifyCancelToken(outcome, SIGNER, NOW).ok).toBe(false);
  });

  it("builds the emailed link only when one-tap links are set up", () => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", SIGNER);
    // The domain comes from NEXT_PUBLIC_SITE_URL, so only the path is pinned.
    expect(cancelLessonUrl(BOOKING_ID, NOW)).toMatch(/\/cancel-lesson\/[\w-]+\.[\w-]+$/);
    vi.stubEnv("LESSON_OUTCOME_SECRET", "");
    expect(cancelLessonUrl(BOOKING_ID, NOW)).toBeNull();
  });
});

describe("cancelView", () => {
  const ok = { ok: true as const, bookingId: BOOKING_ID, expiresAt: new Date(NOW.getTime() + 1e9) };

  it("asks before cancelling a pending lesson that has not started, naming only the short name", () => {
    const view = cancelView({ configured: true, check: ok, booking: pending, now: NOW });
    expect(view).toMatchObject({
      state: "ready",
      heading: "Cancel Jane S.'s lesson?",
      lesson: { student: "Jane S.", when: "Sat, Oct 24 · 9:00 AM CT" },
    });
    expect(view.state === "ready" && view.note).toContain("emails Jane S. that the lesson is cancelled");
  });

  it("says why it cannot cancel, and that nothing changed", () => {
    expect(cancelView({ configured: false, check: null, booking: null, now: NOW }).state).toBe("not_configured");
    expect(cancelView({ configured: true, check: { ok: false, reason: "expired" }, booking: null, now: NOW }).state).toBe("expired");
    expect(cancelView({ configured: true, check: { ok: false, reason: "bad_signature" }, booking: null, now: NOW }).state).toBe("invalid");
    expect(cancelView({ configured: true, check: ok, booking: null, loadFailed: true, now: NOW }).state).toBe("unavailable");
    expect(cancelView({ configured: true, check: ok, booking: null, now: NOW }).state).toBe("missing");
    expect(cancelView({ configured: true, check: ok, booking: { ...pending, status: "cancelled" }, now: NOW }).state).toBe("done");
    expect(cancelView({ configured: true, check: ok, booking: { ...pending, status: "confirmed" }, now: NOW }).state).toBe("settled");
    expect(
      cancelView({ configured: true, check: ok, booking: { ...pending, lesson_date: "2026-10-23", lesson_time: "9:00 AM" }, now: NOW }).state
    ).toBe("started");
  });

  it("shows why the last tap did not save", () => {
    const view = cancelView({ configured: true, check: ok, booking: pending, failed: "save", now: NOW });
    expect(view.state === "ready" && view.alert).toMatch(/didn't save/);
  });
});
