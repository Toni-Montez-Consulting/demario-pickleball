import { track } from "@vercel/analytics/server";
import type { AnalyticsEventName, AnalyticsEvents } from "./analytics";

/**
 * Server-side event, for outcomes only the server can confirm, such as a
 * booking that was actually saved. Sent from the browser, the same event would
 * miss tabs closed mid-request and visitors with blockers, and could be faked
 * from devtools.
 *
 * Passes only the user agent and client IP. Given no headers, track() forwards
 * the incoming request's cookie header to the analytics endpoint, and on the
 * booking route that header can carry an admin's Supabase session.
 *
 * Never throws: a failed analytics call must not affect a booking.
 */
export async function trackServerEvent<E extends AnalyticsEventName>(
  name: E,
  props: AnalyticsEvents[E],
  requestHeaders: Headers
): Promise<void> {
  try {
    await track(name, props as Record<string, string>, {
      headers: {
        "user-agent": requestHeaders.get("user-agent") ?? "",
        "x-forwarded-for": requestHeaders.get("x-forwarded-for") ?? "",
      },
    });
  } catch (err) {
    console.error("[analytics] server event failed", name, err);
  }
}
