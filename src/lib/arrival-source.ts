/**
 * Tagged links: where a visitor found DeMario.
 *
 * Instagram and TikTok open links in their own in-app browsers, which usually
 * send no referrer, so social visits arrive as "unknown". Each place DeMario
 * shares the site gets its own short link. The link redirects to the homepage
 * with utm_source set. SiteAnalytics counts the landing as a tagged_arrival
 * event (grouping pageviews by UTM needs Web Analytics Plus), and the browser
 * tab remembers the code so a booking made later in the same visit can tell
 * DeMario where the student found him.
 *
 * Closed set on purpose: only these codes are ever stored, emailed, or sent.
 * Imported by next.config.ts, so it must not use the "@/" path alias.
 */
export const ARRIVAL_SOURCES = {
  instagram: "Instagram bio link",
  tiktok: "TikTok bio link",
  card: "QR card",
  rebook: "Book-again link (past student)",
} as const;

export type ArrivalSource = keyof typeof ARRIVAL_SOURCES;

export interface ShortLink {
  path: string;
  source: ArrivalSource;
  medium: "bio" | "qr" | "email";
  /** Opens the booking form on arrival, for a student who already knows they want to book. */
  opensBooking?: true;
}

export const SHORT_LINKS: readonly ShortLink[] = [
  { path: "/ig", source: "instagram", medium: "bio" },
  { path: "/tiktok", source: "tiktok", medium: "bio" },
  { path: "/card", source: "card", medium: "qr" },
  // In the review request email and on the review thank-you page.
  { path: "/book-again", source: "rebook", medium: "email", opensBooking: true },
];

export const OPEN_BOOKING_PARAM = "book";

export function shortLinkDestination(link: ShortLink): string {
  const open = link.opensBooking ? `&${OPEN_BOOKING_PARAM}=1` : "";
  return `/?utm_source=${link.source}&utm_medium=${link.medium}${open}`;
}

/** True when the landing URL asks the homepage to open the booking form. */
export function wantsBookingOpen(search: string): boolean {
  return new URLSearchParams(search).get(OPEN_BOOKING_PARAM) === "1";
}

/** The same URL without the open-booking flag, so a refresh or Back does not reopen the form. */
export function withoutBookingFlag(pathname: string, search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete(OPEN_BOOKING_PARAM);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function isArrivalSource(value: unknown): value is ArrivalSource {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ARRIVAL_SOURCES, value);
}

/** The tag on a landing URL's query string, or null for an untagged visit. */
export function arrivalSourceFromSearch(search: string): ArrivalSource | null {
  const value = new URLSearchParams(search).get("utm_source");
  return isArrivalSource(value) ? value : null;
}

const STORAGE_KEY = "dm_arrival_source";

// sessionStorage can be missing or throw (private windows, blocked site data).
// Attribution is a nice-to-have and must never break the page or a booking.
function tabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Remembers a tagged arrival for the rest of this tab's visit, so it survives
 * a trip to /terms and back. An untagged page load leaves an earlier tag alone.
 */
export function rememberArrivalSource(search: string): ArrivalSource | null {
  const source = arrivalSourceFromSearch(search);
  if (!source) return null;
  try {
    tabStorage()?.setItem(STORAGE_KEY, source);
  } catch {
    // Swallowed on purpose: the visit is still counted, just not remembered.
  }
  return source;
}

/** The tag remembered for this tab, or null. Re-checked against the closed set. */
export function recalledArrivalSource(): ArrivalSource | null {
  try {
    const value = tabStorage()?.getItem(STORAGE_KEY) ?? null;
    return isArrivalSource(value) ? value : null;
  } catch {
    return null;
  }
}

/** How the booking email names where a student came from. */
export function arrivalSourceLabel(source: ArrivalSource | null | undefined): string {
  return source ? ARRIVAL_SOURCES[source] : "No tagged link";
}
