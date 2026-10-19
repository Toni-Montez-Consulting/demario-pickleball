import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// When each legal page's text last changed, not the build time, so every deploy
// does not claim they changed. Bump a date in the same commit as any edit to
// that page. These differ from the pages' "Effective" lines, which are legal
// dates: /privacy gained its analytics section on 2026-07-28, and /terms last
// changed on 2026-04-29.
const LEGAL_LAST_MODIFIED = {
  privacy: "2026-07-28",
  terms: "2026-04-29",
} as const;

// /pay is deliberately absent: it is noindex (see src/app/pay/page.tsx).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, lastModified: LEGAL_LAST_MODIFIED.privacy, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: LEGAL_LAST_MODIFIED.terms, changeFrequency: "yearly", priority: 0.3 },
  ];
}
