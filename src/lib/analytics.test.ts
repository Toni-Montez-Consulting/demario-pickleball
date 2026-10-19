import { describe, expect, it } from "vitest";
import { HYBRID_BY_REQUEST_VENUES, PLATFORM_REQUIRED_VENUES } from "@/lib/venue-rules";
import {
  bookingFailure,
  courtSetupCode,
  eventAttributes,
  parseEventAttributes,
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
