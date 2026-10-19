import type { Metadata } from "next";

/** The 1200x630 link-preview card rendered by scripts/generate-og-image.mjs. */
export const OG_IMAGE = {
  url: "/img/og-card.jpg",
  width: 1200,
  height: 630,
  alt: "DeMario Montez, pickleball coach in Dallas–Fort Worth: 4.97 doubles DUPR, top 1% worldwide, top 40 in DFW",
};

/**
 * Complete metadata for a page other than the homepage.
 *
 * Next merges metadata shallowly. A page that sets `openGraph` replaces the
 * layout's whole object, preview image included, and a page that sets nothing
 * inherits the homepage's title, description, and og:url. That is why a shared
 * /pay or /review link previewed as the homepage. Every field a link preview
 * reads is built here, so no page overrides half of it.
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
