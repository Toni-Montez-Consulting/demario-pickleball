import type { Metadata } from "next";
import { DUPR } from "@/lib/dupr";

export const SITE_TITLE = "DeMario Montez — Pickleball Coach · Dallas–Fort Worth";

// One source for the search and link-preview snippet. It was pasted into two
// places before, which is how a stale rating survives an update. Kept under
// ~155 characters so Google does not truncate it.
export const SITE_DESCRIPTION = `Strategic 1:1 pickleball coaching in Dallas–Fort Worth. Book DeMario Montez — ${DUPR.doublesShort} doubles DUPR, top ${DUPR.topPercent}% worldwide, top ${DUPR.dfwTop} in DFW, USPTA certified.`;

/** The 1200x630 link-preview card rendered by scripts/generate-og-image.mjs. */
export const OG_IMAGE = {
  url: "/img/og-card.jpg",
  width: 1200,
  height: 630,
  alt: `DeMario Montez, pickleball coach in Dallas–Fort Worth: ${DUPR.doublesShort} doubles DUPR, top ${DUPR.topPercent}% worldwide, top ${DUPR.dfwTop} in DFW`,
};

/**
 * Complete metadata for a page, homepage included.
 *
 * Next merges metadata shallowly. A page that sets `openGraph` replaces the
 * layout's whole object, preview image included. Every field a link preview
 * reads is built here, so no page overrides half of it. The root layout keeps
 * only site-wide fields, so a page without its own (a /review link, the 404)
 * previews with its own title instead of the homepage's.
 *
 * Paths are relative; metadataBase in the root layout makes them absolute.
 */
export function pageMetadata({
  path,
  title,
  description,
  index = true,
}: {
  path: string;
  title: string;
  description: string;
  index?: boolean;
}): Metadata {
  return {
    title,
    description,
    // A canonical tag on a noindex page sends mixed signals, so only
    // indexable pages claim one.
    ...(index ? { alternates: { canonical: path } } : { robots: { index: false, follow: false } }),
    openGraph: { type: "website", url: path, title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}
