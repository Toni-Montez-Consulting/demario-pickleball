import { track as vercelTrack } from "@vercel/analytics";
import type { CourtSetup } from "@/lib/booking-notes";
import type { LessonKey } from "@/lib/data";

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
export type CtaSource = "nav" | "hero" | "testimonials" | "lessons" | "final_cta" | "sticky";
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
  book_cta_click: { source: CtaSource; lesson_type?: LessonKey };
  booking_step_viewed: { step: BookingStep; court_setup?: CourtSetupCode };
  booking_failed: { reason: BookingFailure };
  booking_created: { lesson_type: LessonKey; court_setup: CourtSetupCode };
  venue_link_click: { venue: VenueCode; surface: Surface };
  contact_click: { channel: ContactChannel; surface: Surface };
  payment_link_click: { method: PaymentMethod; surface: Surface };
  inquiry_submit: { result: SubmitResult };
  review_submit: { result: ReviewResult; path: "public" | "token" };
  outbound_click: { dest: OutboundDest };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

const EVENT_NAMES: ReadonlySet<string> = new Set<AnalyticsEventName>([
  "book_cta_click",
  "booking_step_viewed",
  "booking_failed",
  "booking_created",
  "venue_link_click",
  "contact_click",
  "payment_link_click",
  "inquiry_submit",
  "review_submit",
  "outbound_click",
]);

export function courtSetupCode(value: CourtSetup | string | null | undefined): CourtSetupCode {
  if (value === "Indoor / weather-proof") return "indoor";
  if (value === "Outdoor public court") return "outdoor";
  if (value === "Help me choose") return "help";
  return "none";
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
