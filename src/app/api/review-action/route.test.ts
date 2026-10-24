import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { signOutcomeToken } from "@/lib/lesson-outcomes";
import { signReviewActionToken } from "@/lib/review-moderation";

type Filter = [op: "eq" | "neq", key: string, value: string];

const mocks = vi.hoisted(() => ({
  updates: [] as Array<{ values: Record<string, unknown>; filters: Filter[] }>,
  updateError: null as { message: string } | null,
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        const record = { values, filters: [] as Filter[] };
        mocks.updates.push(record);
        // The second filter ends the chain, as in the route.
        const filter = (op: "eq" | "neq") => (key: string, value: string) => {
          record.filters.push([op, key, value]);
          return record.filters.length === 2 ? Promise.resolve({ error: mocks.updateError }) : chain;
        };
        const chain = { eq: filter("eq"), neq: filter("neq") };
        return chain;
      },
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));

const SIGNER = "fake-signing-value-for-tests";
const REVIEW_ID = "33333333-3333-3333-3333-333333333333";

function formRequest(token: string | null): NextRequest {
  const form = new FormData();
  if (token !== null) form.set("token", token);
  return {
    url: "https://demariomontezpb.com/api/review-action",
    headers: new Headers({ "content-type": "application/x-www-form-urlencoded" }),
    formData: async () => form,
  } as unknown as NextRequest;
}

async function post(token: string | null) {
  const { POST } = await import("./route");
  return POST(formRequest(token));
}

describe("POST /api/review-action", () => {
  beforeEach(() => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", SIGNER);
    mocks.updates = [];
    mocks.updateError = null;
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({ limited: false });
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("takes a review down and returns to the page", async () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: SIGNER });

    const response = await post(token);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://demariomontezpb.com/review-action/${encodeURIComponent(token)}`
    );
    expect(mocks.updates).toEqual([
      {
        values: { status: "hidden", published_at: null },
        filters: [["eq", "id", REVIEW_ID], ["neq", "status", "hidden"]],
      },
    ]);
  });

  // A publish link only moves a waiting review, so it cannot undo a takedown.
  it("publishes only a review that is still waiting", async () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "publish", secret: SIGNER });

    await post(token);

    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].values).toMatchObject({ status: "published" });
    expect(typeof mocks.updates[0].values.published_at).toBe("string");
    expect(mocks.updates[0].filters).toEqual([["eq", "id", REVIEW_ID], ["eq", "status", "pending"]]);
  });

  it("changes nothing for a tampered link, or for a lesson-outcome link", async () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: SIGNER });
    const outcome = signOutcomeToken({ bookingId: REVIEW_ID, outcome: "confirmed", secret: SIGNER });

    expect((await post(`${token.slice(0, -2)}xx`)).status).toBe(303);
    expect((await post(outcome)).status).toBe(303);
    expect(mocks.updates).toHaveLength(0);
  });

  it("refuses a missing or oddly shaped token outright", async () => {
    expect((await post(null)).status).toBe(400);
    expect((await post("not a token")).status).toBe(400);
    expect(mocks.updates).toHaveLength(0);
  });

  it("says when it is rate limited or the save failed", async () => {
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: SIGNER });

    mocks.checkRateLimit.mockResolvedValueOnce({ limited: true });
    expect((await post(token)).headers.get("location")).toMatch(/\?failed=busy$/);

    mocks.updateError = { message: "db down" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(token)).headers.get("location")).toMatch(/\?failed=save$/);
  });

  it("does nothing when links are not configured", async () => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const token = signReviewActionToken({ reviewId: REVIEW_ID, action: "hide", secret: SIGNER });

    expect((await post(token)).status).toBe(303);
    expect(mocks.updates).toHaveLength(0);
  });
});
