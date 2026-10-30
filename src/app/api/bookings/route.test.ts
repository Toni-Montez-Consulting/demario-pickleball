import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { WAIVER_VERSION } from "@/lib/business";

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
  trackServerEvent: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("@/lib/analytics-server", () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

// after() needs a live request scope. Capture the callbacks instead so a test
// can assert the work is deferred, then run it the way the platform would.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

async function runAfterCallbacks() {
  await Promise.all(mocks.afterCallbacks.map((callback) => callback()));
}

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
  private orClauses: Array<{ key: string; value: string }> = [];
  private hasOr = false;
  private limitCount: number | null = null;
  private insertRow: Row | null = null;
  private updateRow: Row | null = null;

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

  // Supports the PostgREST "key.eq.value,key2.eq.value2" form the student
  // lookup uses. A row matches when any clause matches.
  or(expression: string) {
    this.hasOr = true;
    for (const clause of expression.split(",")) {
      const [key, op, ...rest] = clause.split(".");
      if (op === "eq") this.orClauses.push({ key, value: rest.join(".") });
    }
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(row: Row) {
    this.insertRow = {
      id: "12345678-1234-1234-1234-123456789abc",
      ...row,
    };
    return this;
  }

  update(row: Row) {
    this.updateRow = row;
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
    if (this.updateRow) {
      const matched = this.result().data ?? [];
      for (const row of matched) Object.assign(row, this.updateRow);
      return Promise.resolve({ data: matched, error: null } as QueryResult).then(
        onfulfilled,
        onrejected
      );
    }
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }

  private result(): QueryResult {
    const rows = this.tables[this.table] ?? [];
    let data = rows.filter((row) =>
      this.filters.every((filter) =>
        filter.op === "eq"
          ? row[filter.key] === filter.value
          : row[filter.key] !== filter.value
      )
    );
    if (this.hasOr) {
      data = data.filter((row) =>
        this.orClauses.some((clause) => String(row[clause.key]) === clause.value)
      );
    }
    if (this.limitCount !== null) data = data.slice(0, this.limitCount);
    return { data, error: null };
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
  notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
  waiver_accepted: true,
};

describe("POST /api/bookings", () => {
  const inserted: Row[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00-05:00"));
    inserted.length = 0;
    mocks.sendBookingCreatedEmails.mockReset();
    mocks.sendBookingCreatedEmails.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({ limited: false });
    mocks.afterCallbacks.length = 0;
    mocks.trackServerEvent.mockReset();
    mocks.trackServerEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restores console spies even when an assertion fails before a test's own cleanup.
    vi.restoreAllMocks();
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
      notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
      waiver_version: WAIVER_VERSION,
    });
    expect(typeof inserted[0].waiver_signed_at).toBe("string");

    // Sent after the response, never before it.
    expect(mocks.sendBookingCreatedEmails).not.toHaveBeenCalled();
    expect(mocks.trackServerEvent).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(2);
    await runAfterCallbacks();
    expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledOnce();

    // The analytics event carries fixed codes only: no name, email, phone,
    // date, or the student's free-text court note.
    expect(mocks.trackServerEvent).toHaveBeenCalledWith(
      "booking_created",
      { lesson_type: "beginner", court_setup: "outdoor" },
      expect.any(Headers)
    );

    // The booking also creates the student record it hangs off.
    const student = inserted.find((row) => row.phone_normalized !== undefined);
    expect(student).toMatchObject({
      name: "Jane Student",
      phone_normalized: "4693719220",
      email_normalized: "jane@example.com",
      source: "site",
    });
    expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "(469) 371-9220",
        notes: "Preferred court setup: Outdoor public court\nPreferred area or court: Lake Highlands",
      })
    );
  });

  it("tells Mario and the new student record where a tagged visitor came from", async () => {
    mocks.serviceClient = createMockClient(
      {
        time_slots: [{ display_label: "9:00 AM", active: true }],
        bookings: [],
        blocked_slots: [],
        recurring_blocks: [],
      },
      inserted
    );

    const response = await postBooking({ ...VALID_BOOKING_BODY, arrival_source: "instagram" });

    expect(response.status).toBe(201);
    const student = inserted.find((row) => row.phone_normalized !== undefined);
    expect(student).toMatchObject({ metadata: { arrived_via: "instagram" } });
    await runAfterCallbacks();
    expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ arrival_source: "instagram" })
    );
  });

  it("drops an unknown source label without costing the booking", async () => {
    mocks.serviceClient = createMockClient(
      {
        time_slots: [{ display_label: "9:00 AM", active: true }],
        bookings: [],
        blocked_slots: [],
        recurring_blocks: [],
      },
      inserted
    );

    const response = await postBooking({ ...VALID_BOOKING_BODY, arrival_source: "<b>spam</b>" });

    expect(response.status).toBe(201);
    const student = inserted.find((row) => row.phone_normalized !== undefined);
    expect(student).not.toHaveProperty("metadata");
    await runAfterCallbacks();
    expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledWith(
      expect.objectContaining({ arrival_source: null })
    );
  });

  it("keeps the booking when the confirmation emails fail", async () => {
    mocks.serviceClient = createMockClient(
      {
        time_slots: [{ display_label: "9:00 AM", active: true }],
        bookings: [],
        blocked_slots: [],
        recurring_blocks: [],
      },
      inserted
    );
    mocks.sendBookingCreatedEmails.mockRejectedValue(new Error("Resend is down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postBooking(VALID_BOOKING_BODY);

    expect(response.status).toBe(201);
    // The rejection is caught inside the callback, so nothing escapes it.
    await expect(runAfterCallbacks()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[bookings POST] email send failed",
      expect.any(Error)
    );
    consoleError.mockRestore();
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
    expect(mocks.afterCallbacks).toHaveLength(0);
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

  it("accepts a phone number written with dots", async () => {
    mocks.serviceClient = createMockClient(
      {
        time_slots: [{ display_label: "9:00 AM", active: true }],
        bookings: [],
        blocked_slots: [],
        recurring_blocks: [],
      },
      inserted
    );

    const response = await postBooking({ ...VALID_BOOKING_BODY, phone: "214.555.0134" });

    expect(response.status).toBe(201);
    expect(inserted[0]).toMatchObject({ phone: "214.555.0134" });
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

  describe("group formats", () => {
    const openDay = () => ({
      time_slots: [{ display_label: "9:00 AM", active: true }],
      bookings: [],
      blocked_slots: [],
      recurring_blocks: [],
    });

    it("prices a drilling session from DeMario's table and stores the quote", async () => {
      mocks.serviceClient = createMockClient(openDay(), inserted);

      const response = await postBooking({
        ...VALID_BOOKING_BODY,
        lesson_type: "drill_90",
        group_size: 3,
        // A price from the browser is never read.
        quoted_per_person_cents: 1,
        quoted_total_cents: 3,
      });

      expect(response.status).toBe(201);
      expect(inserted[0]).toMatchObject({
        lesson_type: "drill_90",
        group_size: 3,
        quoted_per_person_cents: 3500,
        quoted_total_cents: 10500,
      });
      await runAfterCallbacks();
      expect(mocks.sendBookingCreatedEmails).toHaveBeenCalledWith(
        expect.objectContaining({ group_size: 3, quoted_per_person_cents: 3500, quoted_total_cents: 10500 })
      );
      expect(mocks.trackServerEvent).toHaveBeenCalledWith(
        "booking_created",
        { lesson_type: "drill_90", court_setup: "outdoor" },
        expect.any(Headers)
      );
    });

    it("prices Play with the Pro for the size booked", async () => {
      mocks.serviceClient = createMockClient(openDay(), inserted);

      const response = await postBooking({ ...VALID_BOOKING_BODY, lesson_type: "play_pro", group_size: 2 });

      expect(response.status).toBe(201);
      expect(inserted[0]).toMatchObject({ group_size: 2, quoted_per_person_cents: 4000, quoted_total_cents: 8000 });
    });

    it.each<[string, unknown]>([
      ["drill_60", undefined],
      ["drill_60", 9],
      ["drill_90", 0],
      ["play_pro", 5],
      ["play_pro", "2"],
      ["play_pro", 2.5],
    ])("rejects %s for a group size of %s", async (lesson_type, group_size) => {
      mocks.serviceClient = createMockClient(openDay(), inserted);

      const response = await postBooking({ ...VALID_BOOKING_BODY, lesson_type, group_size });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid group size");
      expect(inserted).toHaveLength(0);
    });

    it("rejects a group size on a lesson that is not a group format", async () => {
      mocks.serviceClient = createMockClient(openDay(), inserted);

      const response = await postBooking({ ...VALID_BOOKING_BODY, lesson_type: "clinic", group_size: 3 });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid group size");
      expect(inserted).toHaveLength(0);
    });

    it("stores no quote on a fixed-fee lesson", async () => {
      mocks.serviceClient = createMockClient(openDay(), inserted);

      const response = await postBooking(VALID_BOOKING_BODY);

      expect(response.status).toBe(201);
      expect(inserted[0]).not.toHaveProperty("group_size");
      expect(inserted[0]).not.toHaveProperty("quoted_total_cents");
    });

    it("rejects a format name that is not a stored lesson type", async () => {
      mocks.serviceClient = createMockClient(openDay(), inserted);

      const response = await postBooking({ ...VALID_BOOKING_BODY, lesson_type: "drill", group_size: 3 });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Invalid lesson type");
      expect(inserted).toHaveLength(0);
    });
  });

  it("rejects direct API bookings for indoor partner-platform courts", async () => {
    mocks.serviceClient = createMockClient({}, inserted);

    const response = await postBooking({
      ...VALID_BOOKING_BODY,
      notes: "Preferred court setup: Indoor / weather-proof\nPreferred area or court: The Grove",
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Indoor and reserved courts must be booked through the required venue path first.");
    expect(inserted).toHaveLength(0);
  });
});
