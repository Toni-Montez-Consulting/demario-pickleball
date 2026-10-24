import { track as vercelTrack } from "@vercel/analytics";
import { isCourtSetup, type CourtSetup } from "@/lib/booking-notes";
import type { LessonKey } from "@/lib/data";
import type { LessonType } from "@/lib/lesson-types";
import type { ArrivalSource } from "@/lib/arrival-source";

/**
 * Every custom analytics event the site sends, and the only values each
 * property may take.
 *
 * Each property is a closed set of short codes, so the type system makes it
 * impossible to send a name, email, phone number, free text, booking ID, or
 * review token. Vercel's Pro plan keeps at most two properties per event.
 *
 * The events answer what pageviews cannot:
 *   1. Which "Book" button starts bookings, and where the booking flow leaks.
 *   2. How many students leave for a partner platform or text/call Mario.
 *      Those conversions never reach this site's database.
 *   3. Whether the contact and review forms fail for real visitors.
 */
/** "link": the form opened itself because the visitor came through /book-again. */
export type CtaSource = "nav" | "hero" | "testimonials" | "lessons" | "final_cta" | "sticky" | "link";
export type BookingStep =
  | "details"
  | "terms"
  | "indoor_routing"
  | "picker"
  | "error"
  | "confirmed";
export type CourtSetupCode = "indoor" | "outdoor" | "help" | "none";
export type BookingFailure = "slot_taken" | "rate_limited" | "invalid" | "server" | "network";
export type VenueCode = "dallas_indoor" | "the_grove" | "life_time" | "teachme_to" | "samuel_grand";
export type ContactChannel = "sms" | "tel" | "email";
export type Surface =
  | "modal"
  | "section"
  | "sticky"
  | "footer"
  | "pay_page"
  | "confirmation"
  | "terms"
  | "privacy"
  | "not_found";
export type PaymentMethod = "cashapp" | "zelle" | "paypal" | "paypal_qr";
export type SubmitResult = "success" | "invalid" | "rate_limited" | "server" | "network";
export type ReviewResult =
  | SubmitResult
  | "missing_rating"
  | "missing_name"
  | "missing_consent"
  | "link_invalid"
  | "link_used";
export type OutboundDest = "instagram" | "tiktok" | "facebook" | "google_review" | "teachme_reviews";

export interface AnalyticsEvents {
  /** The card's format: drilling is one card ("drill") until a length is picked. */
  book_cta_click: { source: CtaSource; lesson_type?: LessonKey };
  booking_step_viewed: { step: BookingStep; court_setup?: CourtSetupCode };
  booking_failed: { reason: BookingFailure };
  /**
   * The stored lesson type, so drilling reports drill_60 or drill_90. Group
   * size stays in the database: the event's two properties are already used.
   */
  booking_created: { lesson_type: LessonType; court_setup: CourtSetupCode };
  venue_link_click: { venue: VenueCode; surface: Surface };
  contact_click: { channel: ContactChannel; surface: Surface };
  payment_link_click: { method: PaymentMethod; surface: Surface };
  inquiry_submit: { result: SubmitResult };
  review_submit: { result: ReviewResult; path: "public" | "token" };
  outbound_click: { dest: OutboundDest };
  /**
   * A visit that landed through a tagged link (/ig, /tiktok, /card). Counted as
   * an event because grouping pageviews by UTM needs Web Analytics Plus.
   */
  tagged_arrival: { source: ArrivalSource };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

// A Record over every event name, so an event added to AnalyticsEvents but not
// here is a type error. A hand-kept list let it compile and then dropped its
// data-evt clicks without a word.
const EVENTS: Record<AnalyticsEventName, true> = {
  book_cta_click: true,
  booking_step_viewed: true,
  booking_failed: true,
  booking_created: true,
  venue_link_click: true,
  contact_click: true,
  payment_link_click: true,
  inquiry_submit: true,
  review_submit: true,
  outbound_click: true,
  tagged_arrival: true,
};
const EVENT_NAMES: ReadonlySet<string> = new Set(Object.keys(EVENTS));

// Keyed by the option labels themselves, so renaming one in booking-notes.ts
// is a type error here instead of every event quietly reporting "none".
const COURT_SETUP_CODES: Record<CourtSetup, CourtSetupCode> = {
  "Indoor / weather-proof": "indoor",
  "Outdoor public court": "outdoor",
  "Help me choose": "help",
};

export function courtSetupCode(value: CourtSetup | string | null | undefined): CourtSetupCode {
  return isCourtSetup(value) ? COURT_SETUP_CODES[value] : "none";
}

const VENUE_CODES: Record<string, VenueCode> = {
  "Dallas Indoor": "dallas_indoor",
  "The Grove": "the_grove",
  "Life Time": "life_time",
  "TeachMe.To": "teachme_to",
  "Samuel-Grand": "samuel_grand",
};

/** A venue rule's shortName as an event code, or null for a venue not listed. */
export function venueCode(shortName: string): VenueCode | null {
  return VENUE_CODES[shortName] ?? null;
}

/** Maps a failed /api/bookings response to its funnel reason. */
export function bookingFailure(status: number | null): BookingFailure {
  if (status === null) return "network";
  if (status === 409) return "slot_taken";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid";
  return "server";
}

/** Same mapping for the contact and review forms. */
export function submitFailure(status: number | null): Exclude<SubmitResult, "success"> {
  if (status === null) return "network";
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid";
  return "server";
}

/**
 * Pages whose last path segment is a credential sent by email: a student's
 * review link, and DeMario's lesson-outcome and review takedown/publish links.
 * Analytics gets the route pattern, never the token. Add any new emailed-link
 * page here, or its token lands in Vercel's logs for as long as it is valid.
 */
export const TOKEN_ROUTES = ["/review", "/lesson-outcome", "/review-action"] as const;

/** The path with its token replaced by "[token]", or null when it carries none. */
export function redactTokenPath(pathname: string): string | null {
  for (const base of TOKEN_ROUTES) {
    const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : "";
    if (rest && !rest.includes("/")) return `${base}/[token]`;
  }
  return null;
}

function definedProps(props: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) out[key] = String(value);
  }
  return out;
}

/** Client-side event. Never throws: analytics must not break a page. */
export function trackEvent<E extends AnalyticsEventName>(name: E, props: AnalyticsEvents[E]): void {
  try {
    vercelTrack(name, definedProps(props));
  } catch {
    // Swallowed on purpose.
  }
}

/**
 * data-* attributes that make a link report a click, for links rendered by
 * server components that cannot take an onClick. SiteAnalytics listens for
 * clicks on [data-evt] and calls parseEventAttributes.
 *
 *   <a href="tel:..." {...eventAttributes("contact_click", { channel: "tel", surface: "footer" })}>
 */
export function eventAttributes<E extends AnalyticsEventName>(
  name: E,
  props: AnalyticsEvents[E]
): Record<string, string> {
  const attrs: Record<string, string> = { "data-evt": name };
  for (const [key, value] of Object.entries(definedProps(props))) {
    attrs[`data-evt-${key.replace(/_/g, "-")}`] = value;
  }
  return attrs;
}

// Short lowercase codes only. The attributes come from eventAttributes, but
// the DOM is mutable, so nothing else is sent even if it is edited.
const CODE = /^[a-z0-9_]{1,32}$/;

/**
 * Reads the attributes eventAttributes wrote (via element.dataset) back into
 * an event. Returns null for anything that is not a known event made of
 * short codes.
 */
export function parseEventAttributes(
  dataset: DOMStringMap
): { name: AnalyticsEventName; props: Record<string, string> } | null {
  const name = dataset.evt;
  if (!name || !EVENT_NAMES.has(name)) return null;
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(dataset)) {
    if (key === "evt" || !key.startsWith("evt") || value === undefined) continue;
    // dataset turns data-evt-at-step into evtAtStep; rebuild at_step.
    const prop = key
      .slice(3)
      .replace(/^[A-Z]/, (c) => c.toLowerCase())
      .replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (!CODE.test(prop) || !CODE.test(value)) return null;
    props[prop] = value;
  }
  if (Object.keys(props).length > 2) return null;
  return { name: name as AnalyticsEventName, props };
}
