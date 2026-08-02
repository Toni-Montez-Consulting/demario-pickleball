import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertBookableSlot, getAvailabilityForDate } from "./availability";

type Row = Record<string, string | number | boolean | null>;
type Tables = Record<string, Row[]>;

interface QueryResult {
  data: Row[] | null;
  error: { message: string } | null;
}

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
  maybeSingle() {
    const result = this.result();
    return Promise.resolve({ data: result.data?.[0] ?? null, error: result.error });
  }
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
  private result(): QueryResult {
    const rows = this.tables[this.table] ?? [];
    return {
      data: rows.filter((row) =>
        this.filters.every((f) => (f.op === "eq" ? row[f.key] === f.value : row[f.key] !== f.value))
      ),
      error: null,
    };
  }
}

function mockSupabase(tables: Tables) {
  return {
    from(table: string) {
      return new MockQuery(table, tables);
    },
  } as unknown as SupabaseClient;
}

// Production slots, verified via GET https://demariomontezpb.com/api/time-slots
const SLOTS = [
  { display_label: "3:00 PM", active: true },
  { display_label: "4:00 PM", active: true },
  { display_label: "5:00 PM", active: true },
  { display_label: "5:30 PM", active: true },
  { display_label: "6:00 PM", active: true },
  { display_label: "7:00 PM", active: true },
];

const noBusy = async () => ({ busy: [], error: null });

describe("PROBE: manual blocks vs long lessons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:00:00-05:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("A: one-off block at 5:00 PM does not stop a 90-min clinic at 4:00 PM", async () => {
    const db = mockSupabase({
      bookings: [],
      blocked_slots: [{ date: "2026-05-04", time: "5:00 PM", all_day: false }],
      recurring_blocks: [],
      time_slots: SLOTS,
    });
    const { data } = await getAvailabilityForDate(db, "2026-05-04", {
      lessonType: "clinic",
      busyProvider: noBusy,
    });
    console.log("A unavailable:", data?.unavailable);
    const gate = await assertBookableSlot(db, "2026-05-04", "4:00 PM", "clinic");
    console.log("A assertBookableSlot:", gate);
    expect(gate).toBeNull(); // null == booking allowed == the gap
  });

  it("B: one-off block at 5:00 PM does not stop a 60-min lesson at 5:30 PM", async () => {
    const db = mockSupabase({
      bookings: [],
      blocked_slots: [{ date: "2026-05-04", time: "5:00 PM", all_day: false }],
      recurring_blocks: [],
      time_slots: SLOTS,
    });
    const gate = await assertBookableSlot(db, "2026-05-04", "5:30 PM", "beginner");
    console.log("B assertBookableSlot:", gate);
    expect(gate).toBeNull();
  });

  it("C: recurring Monday block at 5:00 PM does not stop a 75-min lesson at 4:00 PM", async () => {
    const db = mockSupabase({
      bookings: [],
      blocked_slots: [],
      recurring_blocks: [{ day_of_week: 1, time: "5:00 PM" }],
      time_slots: SLOTS,
    });
    const gate = await assertBookableSlot(db, "2026-05-04", "4:00 PM", "advanced");
    console.log("C assertBookableSlot:", gate);
    expect(gate).toBeNull();
  });

  it("CONTROL: a real 90-min clinic booking at 5:00 PM DOES stop a 4:00 PM clinic", async () => {
    const db = mockSupabase({
      bookings: [
        { lesson_date: "2026-05-04", lesson_time: "5:00 PM", lesson_type: "clinic", status: "confirmed" },
      ],
      blocked_slots: [],
      recurring_blocks: [],
      time_slots: SLOTS,
    });
    const gate = await assertBookableSlot(db, "2026-05-04", "4:00 PM", "clinic");
    console.log("CONTROL assertBookableSlot:", gate);
    expect(gate?.status).toBe(409);
  });
});
