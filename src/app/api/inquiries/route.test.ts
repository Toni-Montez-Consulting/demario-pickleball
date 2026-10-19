import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Row = Record<string, string | number | boolean | null>;

const mocks = vi.hoisted(() => ({
  serviceClient: undefined as unknown,
  checkRateLimit: vi.fn(),
  sendInquiryNotificationEmail: vi.fn(),
  captureMessage: vi.fn(),
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: mocks.captureMessage,
}));

// after() needs a live request scope. Capture the callbacks so a test can
// assert the email is deferred, then run them the way the platform would.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));

vi.mock("@/lib/email/client", () => ({
  sendInquiryNotificationEmail: mocks.sendInquiryNotificationEmail,
}));

async function runAfterCallbacks() {
  await Promise.all(mocks.afterCallbacks.map((callback) => callback()));
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => mocks.serviceClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

class MockQuery {
  private insertRow: Row | null = null;

  constructor(
    private readonly inserted: Row[],
    private readonly failInsert = false,
    private readonly recentCount: number | null = 1
  ) {}

  // The 24-hour count behind the alert cap. null is what supabase-js returns
  // when the count query fails.
  gte() {
    return Promise.resolve({
      count: this.recentCount,
      error: this.recentCount === null ? { message: "count failed" } : null,
    });
  }

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
    if (this.failInsert) {
      return Promise.resolve({ data: null, error: { message: "insert failed" } });
    }
    if (this.insertRow) {
      this.inserted.push(this.insertRow);
      return Promise.resolve({ data: this.insertRow, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

function createMockClient(inserted: Row[], failInsert = false, recentCount: number | null = 1) {
  return {
    from() {
      return new MockQuery(inserted, failInsert, recentCount);
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
    mocks.sendInquiryNotificationEmail.mockReset();
    mocks.sendInquiryNotificationEmail.mockResolvedValue(undefined);
    mocks.captureMessage.mockReset();
    mocks.afterCallbacks.length = 0;
  });

  afterEach(() => {
    // Restores console spies even when an assertion fails before a test's own cleanup.
    vi.restoreAllMocks();
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

    // Mario is emailed after the response, with the stored (normalised) values.
    expect(mocks.sendInquiryNotificationEmail).not.toHaveBeenCalled();
    await runAfterCallbacks();
    expect(mocks.sendInquiryNotificationEmail).toHaveBeenCalledWith({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Do you have clinics this weekend?",
    });
  }, 15000);

  it("still returns 201 when the notification email fails", async () => {
    mocks.sendInquiryNotificationEmail.mockRejectedValue(new Error("Resend is down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postInquiry({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Hello",
    });

    expect(response.status).toBe(201);
    await expect(runAfterCallbacks()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[inquiries POST] notification failed",
      expect.any(Error)
    );
    consoleError.mockRestore();
  });

  it("stops emailing past 20 messages a day but still saves them", async () => {
    mocks.serviceClient = createMockClient(inserted, false, 21);

    const response = await postInquiry({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Hello",
    });

    expect(response.status).toBe(201);
    expect(inserted).toHaveLength(1);
    await runAfterCallbacks();
    expect(mocks.sendInquiryNotificationEmail).not.toHaveBeenCalled();
    // Reported once, on the first message over the cap.
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "Inquiry alerts paused: more than 20 messages in 24 hours",
      "warning"
    );
  });

  it("reports the pause only once", async () => {
    mocks.serviceClient = createMockClient(inserted, false, 22);

    await postInquiry({ name: "Jane Student", email: "jane@example.com", message: "Hello" });
    await runAfterCallbacks();

    expect(mocks.sendInquiryNotificationEmail).not.toHaveBeenCalled();
    expect(mocks.captureMessage).not.toHaveBeenCalled();
  });

  it("still emails Mario when the daily count fails", async () => {
    mocks.serviceClient = createMockClient(inserted, false, null);

    await postInquiry({ name: "Jane Student", email: "jane@example.com", message: "Hello" });
    await runAfterCallbacks();

    expect(mocks.sendInquiryNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it("does not email Mario when the inquiry was not saved", async () => {
    mocks.serviceClient = createMockClient(inserted, true);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await postInquiry({
      name: "Jane Student",
      email: "jane@example.com",
      message: "Hello",
    });

    expect(response.status).toBe(500);
    expect(mocks.afterCallbacks).toHaveLength(0);
    consoleError.mockRestore();
  });

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
    expect(mocks.afterCallbacks).toHaveLength(0);
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
    expect(mocks.afterCallbacks).toHaveLength(0);
  });
});
