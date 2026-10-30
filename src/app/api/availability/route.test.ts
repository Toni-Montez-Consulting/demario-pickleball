import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, string | number | boolean | null>;
type Tables = Record<string, Row[]>;

const mocks = vi.hoisted(() => ({
  serviceClient: undefined as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => mocks.serviceClient,
}));

class MockQuery {
  private filters: Array<{ key: string; value: string | number | boolean | null; op: "eq" | "neq" }> = [];

  constructor(private readonly table: string, private readonly tables: Tables) {}

  select() {
    return this;
  }

  eq(key: string, value: string | number | boolean | null) {
    this.filters.push({ key, value, op: "eq" });
    return this;
  }

  neq(key: string, value: string | number | boolean | null) {
    this.filters.push({ key, value, op: "neq" });
    return this;
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    const rows = this.tables[this.table] ?? [];
    const data = rows.filter((row) =>
      this.filters.every((filter) =>
        filter.op === "eq"
          ? row[filter.key] === filter.value
          : row[filter.key] !== filter.value
      )
    );
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function createMockClient(tables: Tables) {
  return {
    from(table: string) {
      return new MockQuery(table, tables);
    },
  };
}

function requestFor(date: string) {
  return {
    nextUrl: new URL(`http://example.test/api/availability?date=${date}`),
  } as NextRequest;
}

describe("GET /api/availability", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T12:00:00-05:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns booked and blocked times from the server-side availability client", async () => {
    mocks.serviceClient = createMockClient({
      bookings: [{ lesson_date: "2026-05-04", lesson_time: "9:00 AM", status: "pending" }],
      blocked_slots: [{ date: "2026-05-04", time: "2:00 PM", all_day: false }],
      recurring_blocks: [],
    });

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-05-04"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      allDay: false,
      unavailable: ["9:00 AM", "2:00 PM"],
      booked: ["9:00 AM", "2:00 PM"],
      calendarSync: false,
    });
  });

  // A near miss like "True" silently turned the calendar check off, and the
  // health check passed anyway. The answer now says whether it ran.
  it("says whether DeMario's Google Calendar was part of the answer", async () => {
    mocks.serviceClient = createMockClient({ bookings: [], blocked_slots: [], recurring_blocks: [] });
    vi.stubEnv("GOOGLE_CALENDAR_SYNC_ENABLED", "True");
    try {
      const { GET } = await import("./route");
      expect(await (await GET(requestFor("2026-05-04"))).json()).toMatchObject({ calendarSync: false });
    } finally {
      vi.unstubAllEnvs();
    }

    vi.resetModules();
    vi.doMock("@/lib/google-calendar", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/google-calendar")>()),
      isGoogleCalendarSyncEnabled: () => true,
      getGoogleCalendarBusyForDateCached: async () => ({ busy: [], error: null }),
    }));
    try {
      const { GET } = await import("./route");
      expect(await (await GET(requestFor("2026-05-04"))).json()).toMatchObject({ calendarSync: true });
    } finally {
      vi.doUnmock("@/lib/google-calendar");
    }
  });

  // Each answer can cost a Google Calendar query, and no student can book
  // outside the window, so dates outside it get no answer.
  it("answers only for dates inside the 30-day booking window", async () => {
    mocks.serviceClient = createMockClient({});
    const { GET } = await import("./route");

    expect((await GET(requestFor("2026-05-01"))).status).toBe(400); // today
    expect((await GET(requestFor("2026-06-15"))).status).toBe(400); // beyond 30 days
    expect((await GET(requestFor("2025-05-04"))).status).toBe(400);
  });

  it("rejects invalid calendar dates", async () => {
    mocks.serviceClient = createMockClient({});

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-02-31"));

    expect(response.status).toBe(400);
  });
});
