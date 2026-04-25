import { beforeEach, describe, expect, it, vi } from "vitest";
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
    });
  });

  it("rejects invalid calendar dates", async () => {
    mocks.serviceClient = createMockClient({});

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-02-31"));

    expect(response.status).toBe(400);
  });
});
