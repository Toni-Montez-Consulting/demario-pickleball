import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  tables: { bookings: [] as Row[], reviews: [] as Row[] },
  sendReviewRequestEmail: vi.fn(),
}));

/**
 * Just enough of the Supabase query builder for this route, over in-memory
 * tables. Each query runs when it is awaited, in one synchronous step, so a
 * claim (update ... where review_request_sent_at is null) is atomic the way a
 * single SQL UPDATE is.
 */
function query(table: "bookings" | "reviews") {
  const filters: Array<(row: Row) => boolean> = [];
  let mode: "select" | "update" | "insert" = "select";
  let payload: Row = {};
  let returning = false;
  let limit = Infinity;

  const run = () => {
    const rows = mocks.tables[table];
    if (mode === "insert") {
      // created_at is the database default.
      rows.push({ created_at: new Date().toISOString(), ...payload });
      return { data: null, error: null };
    }
    const matched = rows.filter((row) => filters.every((keep) => keep(row)));
    if (mode === "update") {
      for (const row of matched) Object.assign(row, payload);
      return { data: returning ? matched.map((row) => ({ id: row.id })) : null, error: null };
    }
    // A snapshot, as a real query returns: later updates do not reach it.
    return { data: matched.slice(0, limit).map((row) => ({ ...row })), error: null };
  };

  const builder = {
    select: () => {
      if (mode === "update") returning = true;
      return builder;
    },
    update: (values: Row) => {
      mode = "update";
      payload = values;
      return builder;
    },
    insert: (values: Row) => {
      mode = "insert";
      payload = values;
      return builder;
    },
    eq: (key: string, value: unknown) => {
      filters.push((row) => row[key] === value);
      return builder;
    },
    is: (key: string, value: null) => {
      filters.push((row) => (row[key] ?? null) === value);
      return builder;
    },
    gte: (key: string, value: string) => {
      filters.push((row) => String(row[key]) >= value);
      return builder;
    },
    limit: (count: number) => {
      limit = count;
      return builder;
    },
    then: <T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) =>
      Promise.resolve().then(run).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ from: (table: "bookings" | "reviews") => query(table) }),
}));

vi.mock("@/lib/email/client", () => ({
  sendReviewRequestEmail: mocks.sendReviewRequestEmail,
}));

const BOOKING_ID = "11111111-1111-1111-1111-111111111111";

function lessonYesterday(): Row {
  return {
    id: BOOKING_ID,
    name: "Jane Student",
    email: "jane@example.com",
    status: "confirmed",
    lesson_type: "drill_60",
    lesson_date: "2026-10-19",
    lesson_time: "9:00 AM",
    student_id: "22222222-2222-2222-2222-222222222222",
    review_request_sent_at: null,
  };
}

async function runCron() {
  const { GET } = await import("./route");
  const response = await GET({
    headers: new Headers({ authorization: "Bearer cron-secret" }),
  } as NextRequest);
  return response.json();
}

describe("GET /api/cron/review-requests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.tables.bookings = [lessonYesterday()];
    mocks.tables.reviews = [];
    mocks.sendReviewRequestEmail.mockReset();
    mocks.sendReviewRequestEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("asks once per eligible booking, stamping it and storing the review row", async () => {
    const result = await runCron();

    expect(result).toMatchObject({ sent: 1, failed: [] });
    expect(mocks.sendReviewRequestEmail).toHaveBeenCalledOnce();
    expect(mocks.sendReviewRequestEmail.mock.calls[0][0]).toMatchObject({ to: "jane@example.com" });
    expect(mocks.tables.bookings[0].review_request_sent_at).toBe("2026-10-20T15:00:00.000Z");
    expect(mocks.tables.reviews).toHaveLength(1);
    expect(mocks.tables.reviews[0]).toMatchObject({ booking_id: BOOKING_ID, status: "pending" });
  });

  // Vercel can start the same scheduled run twice. Both runs read the booking
  // as unasked; only the one whose claim lands may send.
  it("sends one email when two runs overlap", async () => {
    const [first, second] = await Promise.all([runCron(), runCron()]);

    expect(mocks.sendReviewRequestEmail).toHaveBeenCalledOnce();
    expect(first.sent + second.sent).toBe(1);
    expect(mocks.tables.reviews).toHaveLength(1);
  });

  it("releases the claim when the email fails, so the next run tries again", async () => {
    mocks.sendReviewRequestEmail.mockResolvedValueOnce(false);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failedRun = await runCron();
    expect(failedRun).toMatchObject({ sent: 0, failed: [BOOKING_ID] });
    expect(mocks.tables.bookings[0].review_request_sent_at).toBeNull();
    expect(mocks.tables.reviews).toHaveLength(0);

    const retry = await runCron();
    expect(retry).toMatchObject({ sent: 1 });
    expect(mocks.sendReviewRequestEmail).toHaveBeenCalledTimes(2);
  });

  it("does not ask about a lesson that was not recorded as happened", async () => {
    mocks.tables.bookings = [{ ...lessonYesterday(), status: "pending" }];

    const result = await runCron();

    expect(result.sent).toBe(0);
    expect(mocks.sendReviewRequestEmail).not.toHaveBeenCalled();
  });
});
