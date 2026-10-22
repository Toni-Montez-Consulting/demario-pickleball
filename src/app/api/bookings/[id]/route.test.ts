import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  error: null as { code: string; message: string } | null,
  sendBookingCancelledEmail: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

// after() needs a live request scope. Capture the callbacks so a test can see
// whether an email was queued, then run them the way the platform would.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

vi.mock("@/lib/email/client", () => ({
  sendBookingCancelledEmail: mocks.sendBookingCancelledEmail,
}));

// The update chain the route uses: from().update().eq().select().single().
vi.mock("@/lib/supabase/server", () => ({
  requireAdmin: async () => ({
    ok: true,
    supabase: {
      from: () => {
        const chain = {
          update: () => chain,
          eq: () => chain,
          select: () => chain,
          single: () => Promise.resolve({ data: mocks.row, error: mocks.error }),
        };
        return chain;
      },
    },
  }),
}));

const ID = "12345678-1234-1234-1234-123456789abc";

function cancelledRow(lesson_date: string, lesson_time: string) {
  return {
    id: ID,
    name: "Jane Student",
    email: "jane@example.com",
    lesson_type: "beginner",
    lesson_date,
    lesson_time,
    status: "cancelled",
  };
}

async function patch(body: Record<string, unknown>) {
  const { PATCH } = await import("./route");
  return PATCH({ json: async () => body } as unknown as NextRequest, {
    params: Promise.resolve({ id: ID }),
  });
}

const cancel = () => patch({ status: "cancelled" });

describe("PATCH /api/bookings/[id] cancellation email", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z")); // 10:00 AM Central
    mocks.error = null;
    mocks.sendBookingCancelledEmail.mockReset();
    mocks.sendBookingCancelledEmail.mockResolvedValue(undefined);
    mocks.afterCallbacks.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emails the student when a lesson that has not started is cancelled", async () => {
    mocks.row = cancelledRow("2026-10-19", "11:00 AM");

    expect((await cancel()).status).toBe(200);
    await Promise.all(mocks.afterCallbacks.map((callback) => callback()));

    expect(mocks.sendBookingCancelledEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendBookingCancelledEmail.mock.calls[0][0]).toMatchObject({ email: "jane@example.com" });
  });

  it("records a lesson that already started as didn't happen, without emailing anyone", async () => {
    mocks.row = cancelledRow("2026-05-22", "9:00 AM");

    expect((await cancel()).status).toBe(200);

    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.sendBookingCancelledEmail).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/bookings/[id] lesson happened", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z")); // 10:00 AM Central
    mocks.error = null;
    mocks.afterCallbacks.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // "Confirmed" is what the review cron reads as "the lesson happened".
  it("refuses to mark a lesson that has not started as happened", async () => {
    mocks.row = { ...cancelledRow("2026-10-19", "11:00 AM"), status: "pending" };

    const response = await patch({ status: "confirmed" });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/once it has started/);
  });

  it("marks a lesson that has started as happened", async () => {
    mocks.row = { ...cancelledRow("2026-10-19", "9:00 AM"), status: "pending" };

    expect((await patch({ status: "confirmed" })).status).toBe(200);
  });

  it("reports a failed lookup as a 500, not a missing booking", async () => {
    mocks.row = null;
    mocks.error = { code: "08006", message: "connection failure" };
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await patch({ status: "cancelled" })).status).toBe(500);
    expect((await patch({ status: "confirmed" })).status).toBe(500);
  });

  it("still answers 404 for a booking that does not exist", async () => {
    mocks.row = null;
    mocks.error = { code: "PGRST116", message: "no rows" };

    expect((await patch({ status: "cancelled" })).status).toBe(404);
  });
});
