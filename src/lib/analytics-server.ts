import { track } from "@vercel/analytics/server";
import { SITE_URL } from "@/lib/site";
import type { AnalyticsEventName, AnalyticsEvents } from "./analytics";

/**
 * track() posts to VERCEL_URL, the deployment's generated *.vercel.app address.
 * Vercel Authentication protects those addresses on this project, so the post
 * was redirected to a login page and the event dropped without an error (the
 * library never checks the status). The custom domain is exempt, and it is where
 * the browser's events already go. An explicit VERCEL_WEB_ANALYTICS_ENDPOINT
 * still wins, and previews keep the default.
 */
function pointAtCustomDomain(): void {
  if (process.env.VERCEL_ENV === "production" && !process.env.VERCEL_WEB_ANALYTICS_ENDPOINT) {
    process.env.VERCEL_WEB_ANALYTICS_ENDPOINT = new URL("/_vercel/insights/event", SITE_URL).toString();
  }
}

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
    pointAtCustomDomain();
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
