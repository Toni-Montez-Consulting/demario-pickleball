import { addDays, zonedDateTimeToUtc } from "@/lib/time";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
const TIME_ZONE = "America/Chicago";

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface BusyResult {
  busy: BusyInterval[];
  error: string | null;
}

export interface CalendarSyncConfigStatus {
  enabled: boolean;
  configured: boolean;
  calendarId: string | null;
}

interface OAuthCalendarConfig {
  calendarId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function envValue(name: string): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  if (
    (raw.startsWith("\"") && raw.endsWith("\"")) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    const unquoted = raw.slice(1, -1).trim();
    return unquoted || null;
  }
  return raw;
}

function getConfig(): OAuthCalendarConfig | null {
  const calendarId = envValue("GOOGLE_CALENDAR_ID");
  const clientId = envValue("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!calendarId || !clientId || !clientSecret || !refreshToken) return null;
  return { calendarId, clientId, clientSecret, refreshToken };
}

export function isGoogleCalendarSyncEnabled(): boolean {
  return envValue("GOOGLE_CALENDAR_SYNC_ENABLED") === "true";
}

export function getGoogleCalendarSyncConfigStatus(): CalendarSyncConfigStatus {
  const config = getConfig();
  return {
    enabled: isGoogleCalendarSyncEnabled(),
    configured: Boolean(config),
    calendarId: config?.calendarId ?? null,
  };
}

async function getAccessToken(config: OAuthCalendarConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - 60 > Date.now()) {
    return tokenCache.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null) as
      | { error?: string; error_description?: string }
      | null;
    const reason = data?.error ? `: ${data.error}` : "";
    const description = data?.error_description ? ` (${data.error_description})` : "";
    throw new Error(`Google OAuth refresh failed: ${res.status}${reason}${description}`);
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Google OAuth response did not include an access token");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export async function getGoogleCalendarBusyForDate(date: string): Promise<BusyResult> {
  if (!isGoogleCalendarSyncEnabled()) {
    return { busy: [], error: null };
  }

  const config = getConfig();
  if (!config) {
    return { busy: [], error: "Google Calendar sync is enabled but credentials are incomplete" };
  }

  try {
    const token = await getAccessToken(config);
    const timeMin = zonedDateTimeToUtc(date, { hour: 0, minute: 0 }, TIME_ZONE).toISOString();
    const timeMax = zonedDateTimeToUtc(addDays(date, 1), { hour: 0, minute: 0 }, TIME_ZONE).toISOString();
    const res = await fetch(FREEBUSY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: TIME_ZONE,
        items: [{ id: config.calendarId }],
      }),
    });

    if (!res.ok) {
      return { busy: [], error: `Google FreeBusy request failed: ${res.status}` };
    }

    const data = await res.json() as {
      calendars?: Record<string, { errors?: Array<{ reason?: string }>; busy?: Array<{ start: string; end: string }> }>;
    };
    const calendar = data.calendars?.[config.calendarId];
    const reason = calendar?.errors?.map((err) => err.reason).filter(Boolean).join(", ");
    if (reason) {
      return { busy: [], error: `Google Calendar returned an error: ${reason}` };
    }

    return {
      busy: (calendar?.busy ?? []).map((item) => ({
        start: new Date(item.start),
        end: new Date(item.end),
      })),
      error: null,
    };
  } catch (err) {
    return {
      busy: [],
      error: err instanceof Error ? err.message : "Google Calendar sync failed",
    };
  }
}
