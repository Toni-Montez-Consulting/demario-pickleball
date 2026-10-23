import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  bookings: [] as Row[],
  queryError: null as { message: string } | null,
  sendLessonReminderEmail: vi.fn(),
}));

/**
 * Just enough of the Supabase query builder for this route, over an in-memory
 * table. Each query runs in one synchronous step when awaited, so a claim is
 * atomic the way a single SQL UPDATE is.
 */
function query() {
  const filters: Array<(row: Row) => boolean> = [];
  let mode: "select" | "update" = "select";
  let payload: Row = {};
  let returning = false;

  const run = () => {
    if (mode === "select" && mocks.queryError) return { data: null, error: mocks.queryError };
    const matched = mocks.bookings.filter((row) => filters.every((keep) => keep(row)));
    if (mode === "update") {
      for (const row of matched) Object.assign(row, payload);
      return { data: returning ? matched.map((row) => ({ id: row.id })) : null, error: null };
    }
    return { data: matched.map((row) => ({ ...row })), error: null };
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
    eq: (key: string, value: unknown) => {
      filters.push((row) => row[key] === value);
      return builder;
    },
    is: (key: string, value: null) => {
      filters.push((row) => (row[key] ?? null) === value);
      return builder;
    },
    then: <T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) =>
      Promise.resolve().then(run).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ from: () => query() }),
}));

vi.mock("@/lib/email/client", () => ({
  sendLessonReminderEmail: mocks.sendLessonReminderEmail,
}));

function lessonTomorrow(overrides: Row = {}): Row {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Jane Student",
    email: "jane@example.com",
    phone: "(469) 555-0100",
    status: "pending",
    lesson_type: "beginner",
    lesson_date: "2026-10-24",
    lesson_time: "9:00 AM",
    notes: null,
    created_at: "2026-10-20T18:00:00Z",
    reminder_sent_at: null,
    ...overrides,
  };
}

async function runCron(authorization = "Bearer fake-cron-token") {
  const { GET } = await import("./route");
  const response = await GET({ headers: new Headers({ authorization }) } as NextRequest);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/cron/lesson-reminders", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 9:00 AM in Dallas on Friday, Oct 23.
    vi.setSystemTime(new Date("2026-10-23T14:00:00Z"));
    vi.stubEnv("CRON_SECRET", "fake-cron-token");
    mocks.bookings = [lessonTomorrow()];
    mocks.queryError = null;
    mocks.sendLessonReminderEmail.mockReset();
    mocks.sendLessonReminderEmail.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("turns away a caller without the cron credential", async () => {
    const { status } = await runCron("Bearer wrong");
    expect(status).toBe(401);
    expect(mocks.sendLessonReminderEmail).not.toHaveBeenCalled();
  });

  it("reminds tomorrow's pending lesson once and stamps it", async () => {
    const first = await runCron();
    expect(first.body).toMatchObject({ sent: 1, failed: [] });
    expect(mocks.sendLessonReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com", lesson_date: "2026-10-24" })
    );
    expect(typeof mocks.bookings[0].reminder_sent_at).toBe("string");

    // A second run the same day sends nothing.
    const second = await runCron();
    expect(second.body).toMatchObject({ sent: 0 });
    expect(mocks.sendLessonReminderEmail).toHaveBeenCalledOnce();
  });

  it("leaves cancelled lessons, other days, and just-booked lessons alone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.bookings = [
      lessonTomorrow({ id: "a", status: "cancelled" }),
      lessonTomorrow({ id: "b", lesson_date: "2026-10-25" }),
      lessonTomorrow({ id: "c", created_at: "2026-10-23T10:00:00Z" }),
    ];

    const { body } = await runCron();

    expect(body).toMatchObject({ sent: 0, skipped: { "booked in the last 12 hours": 1 } });
    expect(mocks.sendLessonReminderEmail).not.toHaveBeenCalled();
  });

  it("releases the claim and names the booking when the email fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendLessonReminderEmail.mockResolvedValue(false);

    const { body } = await runCron();

    expect(body).toMatchObject({ sent: 0, failed: ["11111111-1111-1111-1111-111111111111"] });
    expect(mocks.bookings[0].reminder_sent_at).toBeNull();
  });

  it("fails loud when the bookings query fails, for example before the migration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.queryError = { message: 'column bookings.reminder_sent_at does not exist' };

    const { status } = await runCron();

    expect(status).toBe(500);
    expect(mocks.sendLessonReminderEmail).not.toHaveBeenCalled();
  });
});
