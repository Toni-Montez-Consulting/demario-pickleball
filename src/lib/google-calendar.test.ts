import { afterEach, describe, expect, it, vi } from "vitest";
import { getGoogleCalendarBusyForDate, getGoogleCalendarBusyForDateCached } from "./google-calendar";

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

  describe("the cached check for public availability", () => {
    const ENABLED = {
      GOOGLE_CALENDAR_SYNC_ENABLED: "true",
      GOOGLE_CALENDAR_ID: "primary",
      GOOGLE_OAUTH_CLIENT_ID: "client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
      GOOGLE_OAUTH_REFRESH_TOKEN: "refresh-token",
    };

    function stubGoogle(freeBusy: () => Response) {
      const calls: string[] = [];
      vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url === "https://oauth2.googleapis.com/token") {
          return jsonResponse({ access_token: "access-token", expires_in: 3600 });
        }
        calls.push(url);
        return freeBusy();
      }));
      return calls;
    }

    it("asks Google once per date per minute, sharing concurrent requests", async () => {
      process.env = { ...ORIGINAL_ENV, ...ENABLED };
      const calls = stubGoogle(() => jsonResponse({ calendars: { primary: { busy: [] } } }));

      await Promise.all([
        getGoogleCalendarBusyForDateCached("2026-06-01"),
        getGoogleCalendarBusyForDateCached("2026-06-01"),
      ]);
      await getGoogleCalendarBusyForDateCached("2026-06-01");
      expect(calls).toHaveLength(1);

      await getGoogleCalendarBusyForDateCached("2026-06-02");
      expect(calls).toHaveLength(2);
    });

    it("does not keep a failed answer", async () => {
      process.env = { ...ORIGINAL_ENV, ...ENABLED };
      let first = true;
      stubGoogle(() => {
        const failed = first;
        first = false;
        return failed
          ? new Response("{}", { status: 503 })
          : jsonResponse({ calendars: { primary: { busy: [] } } });
      });

      expect((await getGoogleCalendarBusyForDateCached("2026-06-03")).error).toMatch(/503/);
      expect((await getGoogleCalendarBusyForDateCached("2026-06-03")).error).toBeNull();
    });
  });
});
