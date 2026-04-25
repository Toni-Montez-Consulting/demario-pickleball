import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { checkRateLimit, hashRequestIp } from "./rate-limit";

type Row = Record<string, string>;
type Tables = Record<string, Row[]>;

class MockQuery {
  private filters: Array<{ key: string; value: string; op: "eq" | "gte" }> = [];
  private insertRow: Row | null = null;

  constructor(private readonly table: string, private readonly tables: Tables) {}

  select() {
    return this;
  }

  eq(key: string, value: string) {
    this.filters.push({ key, value, op: "eq" });
    return this;
  }

  gte(key: string, value: string) {
    this.filters.push({ key, value, op: "gte" });
    return this;
  }

  insert(row: Row) {
    this.insertRow = { ...row, created_at: row.created_at ?? new Date().toISOString() };
    return this;
  }

  then<TResult1 = { data: Row[] | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    if (this.insertRow) {
      this.tables[this.table] ??= [];
      this.tables[this.table].push(this.insertRow);
      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
    }

    const rows = this.tables[this.table] ?? [];
    const data = rows.filter((row) =>
      this.filters.every((filter) =>
        filter.op === "eq"
          ? row[filter.key] === filter.value
          : row[filter.key] >= filter.value
      )
    );
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function mockSupabase(tables: Tables) {
  return {
    from(table: string) {
      return new MockQuery(table, tables);
    },
  };
}

function request(ip: string) {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as NextRequest;
}

describe("rate limit", () => {
  beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_SALT", "test-salt");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows and records under-limit requests", async () => {
    const tables: Tables = { rate_limit_events: [] };
    const req = request("203.0.113.10");

    const result = await checkRateLimit(mockSupabase(tables) as never, req, {
      route: "bookings",
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    expect(result.limited).toBe(false);
    expect(tables.rate_limit_events).toHaveLength(1);
    expect(tables.rate_limit_events[0]).toMatchObject({
      route: "bookings",
      ip_hash: hashRequestIp(req),
    });
  });

  it("blocks over-limit requests", async () => {
    const req = request("203.0.113.20");
    const ip_hash = hashRequestIp(req);
    const tables: Tables = {
      rate_limit_events: Array.from({ length: 5 }, () => ({
        route: "bookings",
        ip_hash,
        created_at: new Date().toISOString(),
      })),
    };

    const result = await checkRateLimit(mockSupabase(tables) as never, req, {
      route: "bookings",
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    expect(result.limited).toBe(true);
    expect(tables.rate_limit_events).toHaveLength(5);
  });

  it("fails open if storage is unavailable", async () => {
    const supabase = {
      from() {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => Promise.resolve({ data: null, error: { message: "missing table" } }),
              }),
            }),
          }),
        };
      },
    };

    await expect(
      checkRateLimit(supabase as never, request("203.0.113.30"), {
        route: "bookings",
        limit: 5,
        windowMs: 60 * 60 * 1000,
      })
    ).resolves.toEqual({ limited: false });
  });
});
