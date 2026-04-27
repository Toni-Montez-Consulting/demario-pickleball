import { afterEach, describe, expect, it, vi } from "vitest";
import { getGoogleCalendarBusyForDate } from "./google-calendar";

const ORIGINAL_ENV = process.env;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("google-calendar", () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unstubAllGlobals();
  });

  it("uses OAuth refresh-token credentials to load FreeBusy ranges", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      GOOGLE_CALENDAR_SYNC_ENABLED: "true",
      GOOGLE_CALENDAR_ID: "primary",
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token",
    };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({
        calendars: {
          primary: {
            busy: [
              {
                start: "2026-05-04T15:00:00.000Z",
                end: "2026-05-04T16:00:00.000Z",
              },
            ],
          },
        },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGoogleCalendarBusyForDate("2026-05-04");

    expect(result.error).toBeNull();
    expect(result.busy).toEqual([
      {
        start: new Date("2026-05-04T15:00:00.000Z"),
        end: new Date("2026-05-04T16:00:00.000Z"),
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://www.googleapis.com/calendar/v3/freeBusy",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      })
    );
  });

  it("treats quoted empty OAuth values as incomplete configuration", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      GOOGLE_CALENDAR_SYNC_ENABLED: "true",
      GOOGLE_CALENDAR_ID: "primary",
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REFRESH_TOKEN: "\"\"",
    };

    const result = await getGoogleCalendarBusyForDate("2026-05-04");

    expect(result).toEqual({
      busy: [],
      error: "Google Calendar sync is enabled but credentials are incomplete",
    });
  });
});
