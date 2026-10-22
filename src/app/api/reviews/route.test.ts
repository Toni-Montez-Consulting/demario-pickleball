import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { verifyReviewActionToken } from "@/lib/review-moderation";

const PENDING_ID = "44444444-4444-4444-4444-444444444444";
const NEW_ID = "55555555-5555-5555-5555-555555555555";
const SIGNER = "fake-signing-value-for-tests";

const mocks = vi.hoisted(() => ({
  pending: null as { id: string; token_used_at: string | null } | null,
  updates: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  sendReviewNotificationEmail: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  requireAdmin: vi.fn(),
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: mocks.pending, error: null }) }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: () => {
          mocks.updates.push(values);
          return Promise.resolve({ error: null });
        },
      }),
      insert: (values: Record<string, unknown>) => ({
        select: () => ({
          single: () => {
            mocks.inserts.push(values);
            return Promise.resolve({ data: { id: NEW_ID }, error: null });
          },
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ limited: false }),
  hashRequestIp: () => "ip-hash",
}));

vi.mock("@/lib/students", () => ({ findOrCreateStudent: async () => null }));

vi.mock("@/lib/email/client", () => ({
  sendReviewNotificationEmail: mocks.sendReviewNotificationEmail,
}));

async function submit(body: Record<string, unknown>) {
  const { POST } = await import("./route");
  return POST({ json: async () => body, headers: new Headers() } as unknown as NextRequest);
}

async function runAfterCallbacks() {
  await Promise.all(mocks.afterCallbacks.map((callback) => callback()));
}

const linkFrom = (url: string | null) => verifyReviewActionToken(String(url).split("/review-action/")[1], SIGNER);

describe("POST /api/reviews", () => {
  beforeEach(() => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", SIGNER);
    mocks.pending = { id: PENDING_ID, token_used_at: null };
    mocks.updates = [];
    mocks.inserts = [];
    mocks.afterCallbacks = [];
    mocks.sendReviewNotificationEmail.mockReset();
    mocks.sendReviewNotificationEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Tonio, 2026-10-22: verified reviews go live at once, and DeMario can take
  // down a nefarious or untrue one. A low rating goes live like any other.
  it("publishes a verified review with words at once, at any rating, and emails a takedown link", async () => {
    const response = await submit({
      token: "emailed-token",
      rating: 2,
      body: "Too much talking, not enough drilling.",
      displayName: "Sam P.",
      consent: true,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, verified: true, published: true });
    expect(mocks.updates[0]).toMatchObject({ rating: 2, status: "published" });
    expect(typeof mocks.updates[0].published_at).toBe("string");

    await runAfterCallbacks();
    const email = mocks.sendReviewNotificationEmail.mock.calls[0][0];
    expect(email).toMatchObject({ displayName: "Sam P.", rating: 2, verified: true, live: true });
    expect(linkFrom(email.actionUrl)).toMatchObject({ ok: true, reviewId: PENDING_ID, action: "hide" });
  });

  it("keeps a stars-only review off the site and emails no action", async () => {
    const response = await submit({ token: "emailed-token", rating: 5, body: "", displayName: "Sam P.", consent: true });

    expect(await response.json()).toMatchObject({ published: false });
    expect(mocks.updates[0]).not.toHaveProperty("status");

    await runAfterCallbacks();
    expect(mocks.sendReviewNotificationEmail.mock.calls[0][0]).toMatchObject({ live: false, actionUrl: null });
  });

  it("holds a public review for DeMario's one-tap publish", async () => {
    const response = await submit({ rating: 5, body: "Great coach.", displayName: "Jo T.", consent: true });

    expect(await response.json()).toEqual({ ok: true, verified: false, published: false });
    expect(mocks.inserts[0]).toMatchObject({ status: "pending", verified_booking: false });

    await runAfterCallbacks();
    const email = mocks.sendReviewNotificationEmail.mock.calls[0][0];
    expect(email).toMatchObject({ verified: false, live: false });
    expect(linkFrom(email.actionUrl)).toMatchObject({ ok: true, reviewId: NEW_ID, action: "publish" });
  });

  it("keeps the review when the email fails", async () => {
    mocks.sendReviewNotificationEmail.mockRejectedValue(new Error("Resend is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await submit({ token: "emailed-token", rating: 4, body: "Good.", displayName: "Sam P.", consent: true });

    expect(response.status).toBe(201);
    await expect(runAfterCallbacks()).resolves.toBeDefined();
  });

  it("still saves and emails without a one-tap link when links are not set up", async () => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    await submit({ token: "emailed-token", rating: 4, body: "Good.", displayName: "Sam P.", consent: true });
    await runAfterCallbacks();

    expect(mocks.updates[0]).toMatchObject({ status: "published" });
    expect(mocks.sendReviewNotificationEmail.mock.calls[0][0]).toMatchObject({ live: true, actionUrl: null });
  });
});
