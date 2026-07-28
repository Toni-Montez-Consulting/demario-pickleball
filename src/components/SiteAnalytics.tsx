"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics with the review token stripped out of the path.
 *
 * /review/<token> is a one-time credential emailed to a student. Reporting the
 * raw path would ship that token to a third-party analytics service, where it
 * would sit in logs long after the review was submitted. The page view is still
 * counted — it is just counted against /review/[token].
 *
 * beforeSend is a function prop, which is why this wrapper is a client
 * component rather than mounting Analytics directly in the root layout.
 */
export default function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          if (/^\/review\/[^/]+$/.test(url.pathname)) {
            url.pathname = "/review/[token]";
            return { ...event, url: url.toString() };
          }
          return event;
        } catch {
          // Never let analytics break a page render.
          return event;
        }
      }}
    />
  );
}
