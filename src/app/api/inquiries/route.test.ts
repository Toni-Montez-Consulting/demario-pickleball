import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, string | number | boolean | null>;

const mocks = vi.hoisted(() => ({
  serviceClient: undefined as unknown,
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => mocks.serviceClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

class MockQuery {
  private insertRow: Row | null = null;

  constructor(private readonly inserted: Row[]) {}

  insert(row: Row) {
    this.insertRow = {
      id: "12345678-1234-1234-1234-123456789abc",
      ...row,
    };
    return this;
  }

  select() {
    return this;
  }

  single() {
    if (this.insertRow) {
      this.inserted.push(this.insertRow);
      return Promise.resolve({ data: this.insertRow, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

function createMockClient(inserted: Row[]) {
  return {
    from() {
      return new MockQuery(inserted);
    },
  };
}

async function postInquiry(body: Record<string, unknown>) {
  const { POST } = await import("./route");
  return POST({
    headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
    json: async () => body,
  } as NextRequest);
}

describe("POST /api/inquiries", () => {
  const inserted: Row[] = [];

  beforeEach(() => {
    inserted.length = 0;
    mocks.checkRateLimit.mockReset();
    mocks.checkRateLimit.mockResolvedValue({ limited: false });
    mocks.serviceClient = createMockClient(inserted);
  });

  it("creates an inquiry after validation", async () => {
    const response = await postInquiry({
      name: "Jane Student",
      email: "Jane@Example.com",
      message: "Do you have clinics this weekend?",
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("12345678-1234-1234-1234-123456789abc");
    expect(inserted[0]).toMatchObject({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Do you have clinics this weekend?",
    });
  }, 15000);

  it("rejects honeypot submissions before insert", async () => {
    const response = await postInquiry({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Hello",
      company: "Spam Co",
    });

    expect(response.status).toBe(400);
    expect(inserted).toHaveLength(0);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when inquiry attempts are rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 3600 });

    const response = await postInquiry({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Hello",
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(inserted).toHaveLength(0);
  });
});
