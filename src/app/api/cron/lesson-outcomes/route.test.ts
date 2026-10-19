import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { verifyOutcomeToken } from "@/lib/lesson-outcomes";

type Row = Record<string, string | null>;

const mocks = vi.hoisted(() => ({
  rows: [] as Row[],
  queryError: null as { message: string } | null,
  filters: [] as Array<[string, string, string]>,
  sendLessonOutcomeDigest: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: (key: string, value: string) => (mocks.filters.push(["eq", key, value]), query),
        gte: (key: string, value: string) => (mocks.filters.push(["gte", key, value]), query),
        lte: (key: string, value: string) => {
          mocks.filters.push(["lte", key, value]);
          return Promise.resolve({ data: mocks.queryError ? null : mocks.rows, error: mocks.queryError });
        },
      };
      return query;
    },
  }),
}));

vi.mock("@/lib/email/client", () => ({
  sendLessonOutcomeDigest: mocks.sendLessonOutcomeDigest,
}));

const LINK_SECRET = "outcome-secret-for-tests";

async function runCron(authorization = "Bearer cron-secret") {
  const { GET } = await import("./route");
  return GET({ headers: new Headers({ authorization }) } as NextRequest);
}

describe("GET /api/cron/lesson-outcomes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 13:00 UTC on Oct 19 is 8:00 AM in Dallas, when the cron runs.
    vi.setSystemTime(new Date("2026-10-19T13:00:00Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("LESSON_OUTCOME_SECRET", LINK_SECRET);
    mocks.rows = [];
    mocks.queryError = null;
    mocks.filters = [];
    mocks.sendLessonOutcomeDigest.mockReset();
    mocks.sendLessonOutcomeDigest.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("is a logged 500, not a 401, when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await runCron()).status).toBe(500);
    consoleError.mockRestore();
  });

  it("rejects a caller without the cron bearer", async () => {
    expect((await runCron("Bearer nope")).status).toBe(401);
    expect(mocks.sendLessonOutcomeDigest).not.toHaveBeenCalled();
  });

  it("refuses to run without a link secret, loudly", async () => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", "");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await runCron()).status).toBe(500);
    expect(mocks.sendLessonOutcomeDigest).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("asks only about pending lessons from the last three Central days", async () => {
    await runCron();
    expect(mocks.filters).toEqual([
      ["eq", "status", "pending"],
      ["gte", "lesson_date", "2026-10-16"],
      ["lte", "lesson_date", "2026-10-18"],
    ]);
  });

  it("sends nothing when nothing needs an outcome", async () => {
    const response = await runCron();
    expect(await response.json()).toEqual({ lessons: 0, sent: false });
    expect(mocks.sendLessonOutcomeDigest).not.toHaveBeenCalled();
  });

  it("sends one digest, in lesson order, with three signed links per lesson", async () => {
    mocks.rows = [
      { id: "22222222-2222-2222-2222-222222222222", name: "Late Lesson", lesson_type: "advanced", lesson_date: "2026-10-18", lesson_time: "10:00 AM", notes: null },
      { id: "11111111-1111-1111-1111-111111111111", name: "Jane Student", lesson_type: "beginner", lesson_date: "2026-10-18", lesson_time: "9:00 AM", notes: "Preferred court setup: Outdoor public court" },
    ];

    const response = await runCron();

    expect(await response.json()).toEqual({ lessons: 2, sent: true });
    expect(mocks.sendLessonOutcomeDigest).toHaveBeenCalledOnce();
    const lessons = mocks.sendLessonOutcomeDigest.mock.calls[0][0];
    // "9:00 AM" sorts after "10:00 AM" as text; the digest must not.
    expect(lessons.map((l: { name: string }) => l.name)).toEqual(["Jane Student", "Late Lesson"]);
    expect(lessons[0]).toMatchObject({
      lessonName: "Foundations",
      when: "Sun, Oct 18 · 9:00 AM CT",
      courtSetup: "Outdoor public court",
    });
    for (const outcome of ["confirmed", "no_show", "cancelled"] as const) {
      const link: string = lessons[0].links[outcome];
      expect(link.startsWith("https://demariomontezpb.com/lesson-outcome/")).toBe(true);
      const check = verifyOutcomeToken(link.split("/lesson-outcome/")[1], LINK_SECRET);
      expect(check).toMatchObject({ ok: true, bookingId: "11111111-1111-1111-1111-111111111111", outcome });
    }
  });

  it("reports a failed send as 502 without student details", async () => {
    mocks.rows = [
      { id: "11111111-1111-1111-1111-111111111111", name: "Jane Student", lesson_type: "beginner", lesson_date: "2026-10-18", lesson_time: "9:00 AM", notes: null },
    ];
    mocks.sendLessonOutcomeDigest.mockResolvedValue(false);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await runCron();

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("Jane");
    consoleError.mockRestore();
  });
});
