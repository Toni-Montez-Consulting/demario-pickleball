import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getGoogleCalendarSyncConfigStatus: vi.fn(),
  getGoogleCalendarBusyForDate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/google-calendar", () => ({
  getGoogleCalendarSyncConfigStatus: mocks.getGoogleCalendarSyncConfigStatus,
  getGoogleCalendarBusyForDate: mocks.getGoogleCalendarBusyForDate,
}));

function requestFor(date?: string) {
  const url = new URL("http://example.test/api/calendar-sync");
  if (date) url.searchParams.set("date", date);
  return { nextUrl: url } as NextRequest;
}

describe("GET /api/calendar-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireAdmin.mockReset();
    mocks.getGoogleCalendarSyncConfigStatus.mockReset();
    mocks.getGoogleCalendarBusyForDate.mockReset();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      user: { email: "demariomontez10@gmail.com" },
    });
  });

  it("requires an authenticated admin", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-05-04"));

    expect(response.status).toBe(401);
    expect(mocks.getGoogleCalendarSyncConfigStatus).not.toHaveBeenCalled();
  });

  it("rejects invalid diagnostic dates", async () => {
    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-02-31"));

    expect(response.status).toBe(400);
    expect(mocks.getGoogleCalendarSyncConfigStatus).not.toHaveBeenCalled();
  });

  it("reports disabled sync without calling Google", async () => {
    mocks.getGoogleCalendarSyncConfigStatus.mockReturnValue({
      enabled: false,
      configured: false,
      calendarId: null,
    });

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-05-04"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      enabled: false,
      configured: false,
      checkedDate: "2026-05-04",
      ok: false,
      busyCount: 0,
      error: "Google Calendar sync is disabled.",
    });
    expect(mocks.getGoogleCalendarBusyForDate).not.toHaveBeenCalled();
  });

  it("reports incomplete OAuth configuration without calling Google", async () => {
    mocks.getGoogleCalendarSyncConfigStatus.mockReturnValue({
      enabled: true,
      configured: false,
      calendarId: null,
    });

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-05-04"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      enabled: true,
      configured: false,
      checkedDate: "2026-05-04",
      ok: false,
      busyCount: 0,
      error: "Google Calendar OAuth env vars are incomplete.",
    });
    expect(mocks.getGoogleCalendarBusyForDate).not.toHaveBeenCalled();
  });

  it("reports connected sync with the busy block count", async () => {
    mocks.getGoogleCalendarSyncConfigStatus.mockReturnValue({
      enabled: true,
      configured: true,
      calendarId: "primary",
    });
    mocks.getGoogleCalendarBusyForDate.mockResolvedValue({
      busy: [
        { start: new Date("2026-05-04T15:00:00Z"), end: new Date("2026-05-04T16:00:00Z") },
        { start: new Date("2026-05-04T20:00:00Z"), end: new Date("2026-05-04T21:00:00Z") },
      ],
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-05-04"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      enabled: true,
      configured: true,
      calendarId: "primary",
      checkedDate: "2026-05-04",
      ok: true,
      busyCount: 2,
      error: null,
    });
    expect(mocks.getGoogleCalendarBusyForDate).toHaveBeenCalledWith("2026-05-04");
  });

  it("reports Google errors as a not-verified diagnostic", async () => {
    mocks.getGoogleCalendarSyncConfigStatus.mockReturnValue({
      enabled: true,
      configured: true,
      calendarId: "primary",
    });
    mocks.getGoogleCalendarBusyForDate.mockResolvedValue({
      busy: [],
      error: "Google OAuth refresh failed: 400: invalid_grant",
    });

    const { GET } = await import("./route");
    const response = await GET(requestFor("2026-05-04"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      checkedDate: "2026-05-04",
      ok: false,
      busyCount: 0,
      error: "Google OAuth refresh failed: 400: invalid_grant",
    });
  });
});
