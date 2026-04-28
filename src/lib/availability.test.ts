import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertBookableSlot, getAvailabilityForDate, isValidDateString, isWithinPublicBookingWindow } from "./availability";

type Row = Record<string, string | number | boolean | null>;
type Tables = Record<string, Row[]>;

interface QueryResult {
  data: Row[] | null;
  error: { message: string } | null;
}

class MockQuery {
  private filters: Array<{ key: string; value: string | number | boolean | null; op: "eq" | "neq" }> = [];

  constructor(
    private readonly table: string,
    private readonly tables: Tables,
    private readonly errors: Record<string, string> = {}
  ) {}

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

  maybeSingle() {
    const result = this.result();
    return Promise.resolve({
      data: result.data?.[0] ?? null,
      error: result.error,
    });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }

  private result(): QueryResult {
    const error = this.errors[this.table];
    if (error) return { data: null, error: { message: error } };
    const rows = this.tables[this.table] ?? [];
    return {
      data: rows.filter((row) =>
        this.filters.every((filter) =>
          filter.op === "eq"
            ? row[filter.key] === filter.value
            : row[filter.key] !== filter.value
        )
      ),
      error: null,
    };
  }
}

function mockSupabase(tables: Tables, errors: Record<string, string> = {}) {
  return {
    from(table: string) {
      return new MockQuery(table, tables, errors);
    },
  } as unknown as SupabaseClient;
}

describe("availability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:00:00-05:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects calendar rollover dates", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-31")).toBe(false);
  });

  it("keeps public bookings inside the next 30 days", () => {
    expect(isWithinPublicBookingWindow("2026-04-29")).toBe(true);
    expect(isWithinPublicBookingWindow("2026-05-28")).toBe(true);
    expect(isWithinPublicBookingWindow("2026-04-28")).toBe(false);
    expect(isWithinPublicBookingWindow("2026-05-29")).toBe(false);
  });

  it("combines bookings, one-off blocks, and recurring blocks", async () => {
    const supabase = mockSupabase({
      bookings: [
        { lesson_date: "2026-05-04", lesson_time: "10:00 AM", status: "pending" },
        { lesson_date: "2026-05-04", lesson_time: "11:00 AM", status: "cancelled" },
      ],
      blocked_slots: [
        { date: "2026-05-04", time: "2:00 PM", all_day: false },
      ],
      recurring_blocks: [
        { day_of_week: 1, time: "4:00 PM" },
      ],
    });

    const result = await getAvailabilityForDate(supabase, "2026-05-04");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      allDay: false,
      unavailable: ["10:00 AM", "2:00 PM", "4:00 PM"],
    });
  });

  it("blocks slots that overlap Google Calendar busy intervals", async () => {
    const supabase = mockSupabase({
      bookings: [],
      blocked_slots: [],
      recurring_blocks: [],
      time_slots: [
        { display_label: "9:00 AM", active: true },
        { display_label: "10:00 AM", active: true },
        { display_label: "11:00 AM", active: true },
      ],
    });

    const result = await getAvailabilityForDate(supabase, "2026-05-04", {
      lessonType: "beginner",
      busyProvider: async () => ({
        busy: [
          {
            start: new Date("2026-05-04T15:30:00.000Z"),
            end: new Date("2026-05-04T15:45:00.000Z"),
          },
        ],
        error: null,
      }),
    });

    expect(result.error).toBeNull();
    expect(result.data?.unavailable).toContain("10:00 AM");
    expect(result.data?.unavailable).not.toContain("9:00 AM");
    expect(result.data?.unavailable).not.toContain("11:00 AM");
  });

  it("uses lesson duration when checking Google Calendar overlap", async () => {
    const supabase = mockSupabase({
      bookings: [],
      blocked_slots: [],
      recurring_blocks: [],
      time_slots: [{ display_label: "9:00 AM", active: true }],
    });

    const result = await getAvailabilityForDate(supabase, "2026-05-04", {
      lessonType: "advanced",
      busyProvider: async () => ({
        busy: [
          {
            start: new Date("2026-05-04T15:05:00.000Z"),
            end: new Date("2026-05-04T15:30:00.000Z"),
          },
        ],
        error: null,
      }),
    });

    expect(result.error).toBeNull();
    expect(result.data?.unavailable).toContain("9:00 AM");
  });

  it("marks a date all-day unavailable from one-off or recurring blocks", async () => {
    const supabase = mockSupabase({
      bookings: [],
      blocked_slots: [{ date: "2026-05-05", time: null, all_day: true }],
      recurring_blocks: [],
    });

    await expect(getAvailabilityForDate(supabase, "2026-05-05")).resolves.toMatchObject({
      data: { allDay: true },
      error: null,
    });
  });

  it("rejects a recurring blocked booking slot", async () => {
    const supabase = mockSupabase({
      time_slots: [{ display_label: "4:00 PM", active: true }],
      bookings: [],
      blocked_slots: [],
      recurring_blocks: [{ day_of_week: 1, time: "4:00 PM" }],
    });

    const result = await assertBookableSlot(supabase, "2026-05-04", "4:00 PM");

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "That time slot is not available.",
    });
  });

  it("rejects public bookings beyond the 30-day booking window", async () => {
    const supabase = mockSupabase({
      time_slots: [{ display_label: "4:00 PM", active: true }],
      bookings: [],
      blocked_slots: [],
      recurring_blocks: [],
    });

    const result = await assertBookableSlot(supabase, "2026-05-29", "4:00 PM");

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Bookings are available for the next 30 days.",
    });
  });

  it("surfaces dependency failures instead of opening the schedule", async () => {
    const supabase = mockSupabase(
      { bookings: [], blocked_slots: [], recurring_blocks: [] },
      { bookings: "database unavailable" }
    );

    const result = await getAvailabilityForDate(supabase, "2026-05-04");

    expect(result.data).toBeNull();
    expect(result.error).toBe("database unavailable");
  });
});
