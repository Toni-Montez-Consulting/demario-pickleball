const FALLBACK_SITE_URL = "https://demariomontezpb.com";

/**
 * Environment values arrive with stray whitespace more often than anyone expects.
 * A trailing newline on NEXT_PUBLIC_SITE_URL silently corrupted robots.txt, every
 * sitemap <loc>, and the JSON-LD url fields in production — the newline is invisible
 * in review, so it survived for months. Trim before anything consumes it.
 */
export function normalizeSiteUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/+$/, "").trim();
  return trimmed || FALLBACK_SITE_URL;
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
