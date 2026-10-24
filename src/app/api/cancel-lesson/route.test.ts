import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { signCancelToken } from "@/lib/lesson-cancel";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  booking: null as Row | null,
  loadError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  checkRateLimit: vi.fn(),
  sendBookingCancelledEmail: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

// One in-memory booking. The update runs in one step when awaited, so a second
// tap finds the booking no longer pending, as a single SQL UPDATE would.
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.booking ? { ...mocks.booking } : null, error: mocks.loadError }),
        }),
      }),
      update: (values: Row) => {
        const filters: Array<[string, unknown]> = [];
        const chain = {
          eq: (key: string, value: unknown) => {
            filters.push([key, value]);
            return chain;
          },
          select: async () => {
            if (mocks.updateError) return { data: null, error: mocks.updateError };
            const row = mocks.booking;
            if (!row || !filters.every(([key, value]) => row[key] === value)) return { data: [], error: null };
            Object.assign(row, values);
            return { data: [{ id: row.id }], error: null };
          },
        };
        return chain;
      },
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/email/client", () => ({ sendBookingCancelledEmail: mocks.sendBookingCancelledEmail }));

const SIGNER = "fake-signing-value-for-tests";
const BOOKING_ID = "11111111-1111-1111-1111-111111111111";

function formRequest(token: string | null): NextRequest {
  const form = new FormData();
  if (token !== null) form.set("token", token);
  return {
    url: "https://demariomontezpb.com/api/cancel-lesson",
    headers: new Headers(),
    formData: async () => form,
  } as unknown as NextRequest;
}

async function post(token: string | null) {
  const { POST } = await import("./route");
  return POST(formRequest(token));
}

async function runAfterCallbacks() {
  await Promise.all(mocks.afterCallbacks.map((callback) => callback()));
  mocks.afterCallbacks = [];
}

describe("POST /api/cancel-lesson", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 10:00 AM in Dallas on Friday, Oct 23; the lesson is Saturday at 9.
    vi.setSystemTime(new Date("2026-10-23T15:00:00Z"));
    vi.stubEnv("LESSON_OUTCOME_SECRET", SIGNER);
    mocks.booking = {
      id: BOOKING_ID,
      name: "Jane Student",
      email: "jane@example.com",
      status: "pending",
      lesson_type: "beginner",
      lesson_date: "2026-10-24",
      lesson_time: "9:00 AM",
    };
    mocks.loadError = null;
    mocks.updateError = null;
    mocks.afterCallbacks = [];
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({ limited: false });
    mocks.sendBookingCancelledEmail.mockReset();
    mocks.sendBookingCancelledEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("cancels a pending lesson, emails the student once, and returns to the page", async () => {
    const token = signCancelToken({ bookingId: BOOKING_ID, secret: SIGNER });

    const response = await post(token);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`https://demariomontezpb.com/cancel-lesson/${token}`);
    expect(mocks.booking?.status).toBe("cancelled");
    expect(mocks.sendBookingCancelledEmail).not.toHaveBeenCalled();
    await runAfterCallbacks();
    expect(mocks.sendBookingCancelledEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: BOOKING_ID, email: "jane@example.com", lesson_date: "2026-10-24" })
    );

    // A second tap changes nothing and sends nothing.
    await post(token);
    await runAfterCallbacks();
    expect(mocks.sendBookingCancelledEmail).toHaveBeenCalledOnce();
  });

  it("leaves a lesson that has started, has an outcome, or has an unreadable time alone", async () => {
    const token = signCancelToken({ bookingId: BOOKING_ID, secret: SIGNER });

    mocks.booking = { ...mocks.booking, lesson_date: "2026-10-23", lesson_time: "9:00 AM" };
    await post(token);
    expect(mocks.booking?.status).toBe("pending");

    mocks.booking = { ...mocks.booking, lesson_date: "2026-10-24", status: "confirmed" };
    await post(token);
    expect(mocks.booking?.status).toBe("confirmed");

    // An unreadable time is refused rather than read as "not started".
    mocks.booking = { ...mocks.booking, status: "pending", lesson_time: "9am" };
    await post(token);
    expect(mocks.booking?.status).toBe("pending");

    await runAfterCallbacks();
    expect(mocks.sendBookingCancelledEmail).not.toHaveBeenCalled();
  });

  it("changes nothing for a link signed with another secret", async () => {
    const token = signCancelToken({ bookingId: BOOKING_ID, secret: "another-value" });

    const response = await post(token);

    expect(response.status).toBe(303);
    expect(mocks.booking?.status).toBe("pending");
  });

  it("says so on the page when the save fails or the hour's limit is hit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const token = signCancelToken({ bookingId: BOOKING_ID, secret: SIGNER });

    mocks.updateError = { message: "down" };
    expect((await post(token)).headers.get("location")).toContain("?failed=save");

    mocks.checkRateLimit.mockResolvedValue({ limited: true });
    expect((await post(token)).headers.get("location")).toContain("?failed=busy");
    expect(mocks.sendBookingCancelledEmail).not.toHaveBeenCalled();
  });

  it("rejects a request with no token or a malformed one", async () => {
    expect((await post(null)).status).toBe(400);
    expect((await post("has spaces.in it")).status).toBe(400);
  });
});
