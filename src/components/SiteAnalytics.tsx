"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { parseEventAttributes, trackEvent } from "@/lib/analytics";

/**
 * Vercel Web Analytics with the review token stripped out of the path.
 *
 * /review/<token> is a one-time credential emailed to a student. Reporting the
 * raw path would ship that token to a third-party analytics service, where it
 * would sit in logs long after the review was submitted. The page view is still
 * counted — it is just counted against /review/[token]. beforeSend sees custom
 * events too, so their URLs get the same treatment.
 *
 * beforeSend is a function prop, which is why this wrapper is a client
 * component rather than mounting Analytics directly in the root layout.
 *
 * It also reports clicks on links marked with eventAttributes() (tel:, sms:,
 * partner platforms, payment links). Many of those links are rendered by server
 * components, which cannot take an onClick, so one capture-phase listener reads
 * the data-evt attributes instead. Capture phase means the event is queued
 * before the browser follows the link.
 */
export default function SiteAnalytics() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // A middle click opens the link in a new tab and fires auxclick, not
      // click. Other buttons (a right click) never follow the link.
      if (e.type === "auxclick" && e.button !== 1) return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-evt]") : null;
      if (!target) return;
      const event = parseEventAttributes(target.dataset);
      if (event) {
        // Validated against the event list and short-code rules above.
        trackEvent(event.name, event.props as never);
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("auxclick", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("auxclick", onClick, { capture: true });
    };
  }, []);

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
