import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /pay is deliberately absent: it is noindex (see src/app/pay/page.tsx).
// The legal pages carry their effective dates, not the build time, so every
// deploy does not claim they changed. Update a date when its page changes.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: "2026-10-19", changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: "2026-04-23", changeFrequency: "yearly", priority: 0.3 },
  ];
}
