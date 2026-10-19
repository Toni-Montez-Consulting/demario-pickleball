import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { signOutcomeToken } from "@/lib/lesson-outcomes";

const mocks = vi.hoisted(() => ({
  updates: [] as Array<{ values: Record<string, string>; filters: Array<[string, string]> }>,
  updateError: null as { message: string } | null,
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      update: (values: Record<string, string>) => {
        const record = { values, filters: [] as Array<[string, string]> };
        mocks.updates.push(record);
        const chain = {
          eq: (key: string, value: string) => {
            record.filters.push([key, value]);
            // The second eq ends the chain, as in the route.
            return record.filters.length === 2
              ? Promise.resolve({ error: mocks.updateError })
              : chain;
          },
        };
        return chain;
      },
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));

const SECRET = "outcome-secret-for-tests";
const BOOKING_ID = "11111111-1111-1111-1111-111111111111";

function formRequest(token: string | null): NextRequest {
  const form = new FormData();
  if (token !== null) form.set("token", token);
  return {
    url: "https://demariomontezpb.com/api/lesson-outcome",
    headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
    formData: async () => form,
  } as unknown as NextRequest;
}

async function post(token: string | null) {
  const { POST } = await import("./route");
  return POST(formRequest(token));
}

describe("POST /api/lesson-outcome", () => {
  beforeEach(() => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", SECRET);
    mocks.updates = [];
    mocks.updateError = null;
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({ limited: false });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("records the outcome only if the booking is still pending, then returns to the page", async () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "no_show", secret: SECRET });

    const response = await post(token);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://demariomontezpb.com/lesson-outcome/${encodeURIComponent(token)}`
    );
    expect(mocks.updates).toEqual([
      { values: { status: "no_show" }, filters: [["id", BOOKING_ID], ["status", "pending"]] },
    ]);
  });

  it("changes nothing for a tampered token but still explains it on the page", async () => {
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "confirmed", secret: "someone-else" });

    const response = await post(token);

    expect(response.status).toBe(303);
    expect(mocks.updates).toHaveLength(0);
  });

  it("rejects a missing token", async () => {
    expect((await post(null)).status).toBe(400);
    expect(mocks.updates).toHaveLength(0);
  });

  it("is rate limited before any token work", async () => {
    mocks.checkRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 3600 });
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "confirmed", secret: SECRET });

    const response = await post(token);

    expect(response.status).toBe(429);
    expect(mocks.updates).toHaveLength(0);
  });

  it("is a 503 when outcome links are not configured", async () => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", "");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await post("anything")).status).toBe(503);
    expect(mocks.updates).toHaveLength(0);
    consoleError.mockRestore();
  });

  it("reports a database failure instead of pretending it worked", async () => {
    mocks.updateError = { message: "boom" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = signOutcomeToken({ bookingId: BOOKING_ID, outcome: "confirmed", secret: SECRET });

    expect((await post(token)).status).toBe(500);
    consoleError.mockRestore();
  });
});
