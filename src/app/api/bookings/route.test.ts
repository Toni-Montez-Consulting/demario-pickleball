import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, string | number | boolean | null>;
type Tables = Record<string, Row[]>;

interface QueryResult {
  data: Row[] | null;
  error: { code?: string; message: string } | null;
}

const mocks = vi.hoisted(() => ({
  serviceClient: undefined as unknown,
  sendBookingCreatedEmails: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => mocks.serviceClient,
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/email/client", () => ({
  sendBookingCreatedEmails: mocks.sendBookingCreatedEmails,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

class MockQuery {
  private filters: Array<{ key: string; value: string | number | boolean | null; op: "eq" | "neq" }> = [];
  private insertRow: Row | null = null;

  constructor(
    private readonly table: string,
    private readonly tables: Tables,
    private readonly inserted: Row[]
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

  insert(row: Row) {
    this.insertRow = {
      id: "12345678-1234-1234-1234-123456789abc",
      ...row,
    };
    return this;
  }

  maybeSingle() {
    const result = this.result();
    return Promise.resolve({
      data: result.data?.[0] ?? null,
      error: result.error,
    });
  }

  single() {
    if (this.insertRow) {
      this.inserted.push(this.insertRow);
      return Promise.resolve({ data: this.insertRow, error: null });
    }
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

function createMockClient(tables: Tables, inserted: Row[]) {
  return {
    from(table: string) {
      return new MockQuery(table, tables, inserted);
    },
  };
}

async function postBooking(body: Record<string, unknown>) {
  const { POST } = await import("./route");
  return POST({
    headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
    json: async () => body,
  } as NextRequest);
}

const VALID_BOOKING_BODY = {
  name: "Jane Student",
  email: "jane@example.com",
  phone: "(469) 371-9220",
  lesson_type: "beginner",
  lesson_date: "2026-05-04",
  lesson_time: "9:00 AM",
  notes: "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove",
  waiver_accepted: true,
};

describe("POST /api/bookings", () => {
  const inserted: Row[] = [];

  beforeEach(() => {
    inserted.length = 0;
    mocks.sendBookingCreatedEmails.mockReset();
    mocks.sendBookingCreatedEmails.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({ limited: false });
  });

  it("creates a booking with waiver metadata after validating availability", async () => {
    mocks.serviceClient = createMockClient(
      {
        time_slots: [{ display_label: "9:00 AM", active: true }],
        bookings: [],
        blocked_slots: [],
        recurring_blocks: [],
      },
      inserted
    );

    const response = await postBooking({
      ...VALID_BOOKING_BODY,
      email: "Jane@Example.com",
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("12345678-1234-1234-1234-123456789abc");
    expect(inserted[0]).toMatchObject({
      email: "jane@example.com",
      phone: "(469) 371-9220",
      notes: "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove",
      waiver_version: "2026-04-24",
    });
    expect(typeof inserted[0].waiver_signed_at).toBe("string");
    expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledOnce();
    expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(469) 371-9220",
        notes: "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove",
      })
    );
  });

  it("rejects a recurring blocked slot before insert", async () => {
    mocks.serviceClient = createMockClient(
      {
        time_slots: [{ display_label: "9:00 AM", active: true }],
        bookings: [],
        blocked_slots: [],
        recurring_blocks: [{ day_of_week: 1, time: "9:00 AM" }],
      },
      inserted
    );

    const response = await postBooking(VALID_BOOKING_BODY);

    expect(response.status).toBe(409);
    expect(inserted).toHaveLength(0);
    expect(mocks.sendBookingCreatedEmails).not.toHaveBeenCalled();
  });

  it("requires waiver acceptance", async () => {
    mocks.serviceClient = createMockClient({}, inserted);

    const response = await postBooking({
      ...VALID_BOOKING_BODY,
      waiver_accepted: false,
    });

    expect(response.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it("rejects honeypot submissions before insert", async () => {
    mocks.serviceClient = createMockClient({}, inserted);

    const response = await postBooking({
      ...VALID_BOOKING_BODY,
      company: "Spam Co",
    });

    expect(response.status).toBe(400);
    expect(inserted).toHaveLength(0);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when booking attempts are rate limited", async () => {
    mocks.serviceClient = createMockClient({}, inserted);
    mocks.checkRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 3600 });

    const response = await postBooking(VALID_BOOKING_BODY);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(inserted).toHaveLength(0);
  });

  it("requires a valid phone number", async () => {
    mocks.serviceClient = createMockClient({}, inserted);

    const response = await postBooking({
      ...VALID_BOOKING_BODY,
      phone: "",
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid phone number");
    expect(inserted).toHaveLength(0);
  });

  it("requires a preferred court setup in notes", async () => {
    mocks.serviceClient = createMockClient({}, inserted);

    const response = await postBooking({
      ...VALID_BOOKING_BODY,
      notes: "Preferred court setup: Something else",
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Preferred court setup is required.");
    expect(inserted).toHaveLength(0);
  });
});
