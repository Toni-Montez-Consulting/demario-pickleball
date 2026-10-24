import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { verifyCancelToken } from "@/lib/lesson-cancel";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  bookings: [] as Row[],
  queryError: null as { message: string } | null,
  sendCoachTomorrowEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const filters: Array<[string, unknown]> = [];
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return chain;
        },
        then: <T>(resolve: (value: { data: Row[] | null; error: unknown }) => T) =>
          Promise.resolve(
            mocks.queryError
              ? { data: null, error: mocks.queryError }
              : { data: mocks.bookings.filter((row) => filters.every(([k, v]) => row[k] === v)), error: null }
          ).then(resolve),
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/email/client", () => ({ sendCoachTomorrowEmail: mocks.sendCoachTomorrowEmail }));

const SIGNER = "fake-signing-value-for-tests";

function lesson(overrides: Row = {}): Row {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Jane Student",
    phone: "(469) 555-0100",
    status: "pending",
    lesson_type: "beginner",
    lesson_date: "2026-10-24",
    lesson_time: "9:00 AM",
    notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
    group_size: null,
    ...overrides,
  };
}

async function runCron(authorization = "Bearer fake-cron-token") {
  const { GET } = await import("./route");
  const response = await GET({ headers: new Headers({ authorization }) } as NextRequest);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/cron/coach-tomorrow", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 9:00 AM in Dallas on Friday, Oct 23.
    vi.setSystemTime(new Date("2026-10-23T14:00:00Z"));
    vi.stubEnv("CRON_SECRET", "fake-cron-token");
    vi.stubEnv("LESSON_OUTCOME_SECRET", SIGNER);
    mocks.bookings = [];
    mocks.queryError = null;
    mocks.sendCoachTomorrowEmail.mockReset();
    mocks.sendCoachTomorrowEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("turns away a caller without the cron credential", async () => {
    expect((await runCron("Bearer wrong")).status).toBe(401);
  });

  it("sends nothing on a day with no site lessons tomorrow", async () => {
    mocks.bookings = [lesson({ lesson_date: "2026-10-25" }), lesson({ status: "cancelled" })];

    const { body } = await runCron();

    expect(body).toEqual({ lessons: 0, sent: false });
    expect(mocks.sendCoachTomorrowEmail).not.toHaveBeenCalled();
  });

  it("lists tomorrow's pending lessons by time, each with its own cancel link", async () => {
    mocks.bookings = [
      lesson({ id: "22222222-2222-2222-2222-222222222222", name: "Sam Player", lesson_time: "1:00 PM", lesson_type: "drill_90", group_size: 3 }),
      lesson(),
    ];

    const { body } = await runCron();

    expect(body).toEqual({ lessons: 2, sent: true });
    const [lessons, dateLabel] = mocks.sendCoachTomorrowEmail.mock.calls[0];
    expect(dateLabel).toBe("Sat, Oct 24");
    expect(lessons.map((l: Row) => l.time)).toEqual(["9:00 AM", "1:00 PM"]);
    expect(lessons[0]).toMatchObject({
      name: "Jane Student",
      phone: "(469) 555-0100",
      courtSetup: "Outdoor public court",
      preferredArea: "Lake Highlands",
    });
    expect(lessons[1]).toMatchObject({ players: "3 players" });
    const link = String(lessons[0].cancelUrl).split("/cancel-lesson/")[1];
    expect(verifyCancelToken(link, SIGNER)).toMatchObject({ ok: true, bookingId: "11111111-1111-1111-1111-111111111111" });
  });

  it("lists a lesson whose time cannot be read first, and says so in the logs", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.bookings = [lesson(), lesson({ id: "33333333-3333-3333-3333-333333333333", lesson_time: "noonish" })];

    await runCron();

    const [lessons] = mocks.sendCoachTomorrowEmail.mock.calls[0];
    expect(lessons.map((l: Row) => l.time)).toEqual(["noonish", "9:00 AM"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unreadable lesson time"), "noonish");
  });

  it("still sends, without cancel links, when one-tap links are not set up", async () => {
    vi.stubEnv("LESSON_OUTCOME_SECRET", "");
    mocks.bookings = [lesson()];

    await runCron();

    expect(mocks.sendCoachTomorrowEmail.mock.calls[0][0][0]).toMatchObject({ cancelUrl: null });
  });

  it("reports a failed query or send instead of claiming success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.bookings = [lesson()];
    mocks.sendCoachTomorrowEmail.mockResolvedValue(false);
    expect((await runCron()).status).toBe(502);

    mocks.queryError = { message: "down" };
    expect((await runCron()).status).toBe(500);
  });
});
