import { afterEach, describe, expect, it } from "vitest";
import { HYBRID_BY_REQUEST_VENUES, PLATFORM_REQUIRED_VENUES } from "@/lib/venue-rules";
import {
  OWNER_DEVICE_KEY,
  bookingFailure,
  courtSetupCode,
  eventAttributes,
  isOwnerPath,
  parseEventAttributes,
  prepareAnalyticsEvent,
  redactTokenPath,
  submitFailure,
  venueCode,
} from "./analytics";

/** Builds the dataset the browser would derive from the given attributes. */
function datasetOf(attrs: Record<string, string>): DOMStringMap {
  const el = document.createElement("a");
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el.dataset;
}

describe("eventAttributes / parseEventAttributes", () => {
  it("round-trips an event through data attributes", () => {
    const attrs = eventAttributes("contact_click", { channel: "tel", surface: "not_found" });
    expect(attrs).toEqual({
      "data-evt": "contact_click",
      "data-evt-channel": "tel",
      "data-evt-surface": "not_found",
    });
    expect(parseEventAttributes(datasetOf(attrs))).toEqual({
      name: "contact_click",
      props: { channel: "tel", surface: "not_found" },
    });
  });

  it("rebuilds snake_case property names", () => {
    const attrs = eventAttributes("book_cta_click", { source: "lessons", lesson_type: "clinic" });
    expect(parseEventAttributes(datasetOf(attrs))?.props).toEqual({
      source: "lessons",
      lesson_type: "clinic",
    });
  });

  it("leaves out undefined properties", () => {
    expect(eventAttributes("book_cta_click", { source: "hero" })).toEqual({
      "data-evt": "book_cta_click",
      "data-evt-source": "hero",
    });
  });

  it("ignores an unknown event name", () => {
    expect(parseEventAttributes(datasetOf({ "data-evt": "steal_cookies" }))).toBeNull();
  });

  it("refuses anything that is not a short code, so edited markup cannot leak text", () => {
    expect(
      parseEventAttributes(
        datasetOf({ "data-evt": "contact_click", "data-evt-channel": "jane@example.com" })
      )
    ).toBeNull();
    expect(
      parseEventAttributes(
        datasetOf({ "data-evt": "contact_click", "data-evt-channel": "x".repeat(33) })
      )
    ).toBeNull();
  });

  it("refuses more than the two properties Vercel keeps", () => {
    expect(
      parseEventAttributes(
        datasetOf({
          "data-evt": "contact_click",
          "data-evt-channel": "tel",
          "data-evt-surface": "footer",
          "data-evt-extra": "x",
        })
      )
    ).toBeNull();
  });
});

describe("code helpers", () => {
  it("maps court setup labels to codes", () => {
    expect(courtSetupCode("Indoor / weather-proof")).toBe("indoor");
    expect(courtSetupCode("Outdoor public court")).toBe("outdoor");
    expect(courtSetupCode("Help me choose")).toBe("help");
    expect(courtSetupCode("")).toBe("none");
    expect(courtSetupCode(null)).toBe("none");
  });

  it("maps booking responses to funnel reasons", () => {
    expect(bookingFailure(409)).toBe("slot_taken");
    expect(bookingFailure(429)).toBe("rate_limited");
    expect(bookingFailure(400)).toBe("invalid");
    expect(bookingFailure(500)).toBe("server");
    expect(bookingFailure(null)).toBe("network");
  });

  it("maps form responses to results", () => {
    expect(submitFailure(429)).toBe("rate_limited");
    expect(submitFailure(422)).toBe("invalid");
    expect(submitFailure(503)).toBe("server");
    expect(submitFailure(null)).toBe("network");
  });

  it("maps venue short names and rejects unlisted venues", () => {
    expect(venueCode("The Grove")).toBe("the_grove");
    expect(venueCode("TeachMe.To")).toBe("teachme_to");
    expect(venueCode("Some New Club")).toBeNull();
  });

  it("has a code for every partner venue, so renaming one cannot silently stop its clicks", () => {
    for (const rule of [...PLATFORM_REQUIRED_VENUES, ...HYBRID_BY_REQUEST_VENUES]) {
      expect(venueCode(rule.shortName), rule.name).not.toBeNull();
    }
  });
});

describe("redactTokenPath", () => {
  it("replaces the token in every emailed-link page", () => {
    expect(redactTokenPath("/review/abc123")).toBe("/review/[token]");
    expect(redactTokenPath("/lesson-outcome/eyJh.sig")).toBe("/lesson-outcome/[token]");
    expect(redactTokenPath("/review-action/eyJh.sig")).toBe("/review-action/[token]");
    expect(redactTokenPath("/cancel-lesson/eyJh.sig")).toBe("/cancel-lesson/[token]");
  });

  it("leaves ordinary pages alone", () => {
    expect(redactTokenPath("/")).toBeNull();
    expect(redactTokenPath("/review")).toBeNull();
    expect(redactTokenPath("/review/")).toBeNull();
    expect(redactTokenPath("/reviews/abc")).toBeNull();
    expect(redactTokenPath("/admin/reviews")).toBeNull();
  });
});

describe("prepareAnalyticsEvent", () => {
  const pageview = (path: string) => ({
    type: "pageview" as const,
    url: `https://demariomontezpb.com${path}`,
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("sends public pages as they are, and a review link without its token", () => {
    expect(prepareAnalyticsEvent(pageview("/?utm_source=card"))).toEqual(pageview("/?utm_source=card"));
    expect(prepareAnalyticsEvent(pageview("/review/abc123"))).toEqual(pageview("/review/[token]"));
  });

  it("drops admin and the one-tap pages, and stops counting that device", () => {
    expect(prepareAnalyticsEvent(pageview("/admin"))).toBeNull();
    expect(prepareAnalyticsEvent(pageview("/admin/reviews"))).toBeNull();
    expect(prepareAnalyticsEvent(pageview("/cancel-lesson/eyJh.sig"))).toBeNull();
    expect(window.localStorage.getItem(OWNER_DEVICE_KEY)).toBe("1");
    // The same device on the homepage, or tapping a button, is still an owner.
    expect(prepareAnalyticsEvent(pageview("/"))).toBeNull();
    expect(prepareAnalyticsEvent({ type: "event" as const, url: "https://demariomontezpb.com/" })).toBeNull();
  });

  it("knows which pages only the owners open", () => {
    for (const path of ["/admin", "/admin/login", "/lesson-outcome/x", "/review-action/x", "/cancel-lesson/x"]) {
      expect(isOwnerPath(path), path).toBe(true);
    }
    for (const path of ["/", "/review", "/review/abc", "/administrator", "/terms"]) {
      expect(isOwnerPath(path), path).toBe(false);
    }
  });

  it("still sends public pages and drops owner pages when storage is blocked", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      expect(prepareAnalyticsEvent(pageview("/admin"))).toBeNull();
      expect(prepareAnalyticsEvent(pageview("/"))).toEqual(pageview("/"));
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
      else delete (window as { localStorage?: Storage }).localStorage;
    }
  });
});
