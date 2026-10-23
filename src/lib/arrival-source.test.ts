import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SHORT_LINKS,
  arrivalSourceFromSearch,
  arrivalSourceLabel,
  isArrivalSource,
  recalledArrivalSource,
  rememberArrivalSource,
  shortLinkDestination,
  wantsBookingOpen,
  withoutBookingFlag,
} from "./arrival-source";

describe("tagged links", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends each short link to the homepage with its source", () => {
    expect(SHORT_LINKS.map((link) => [link.path, shortLinkDestination(link)])).toEqual([
      ["/ig", "/?utm_source=instagram&utm_medium=bio"],
      ["/tiktok", "/?utm_source=tiktok&utm_medium=bio"],
      ["/card", "/?utm_source=card&utm_medium=qr"],
      ["/book-again", "/?utm_source=rebook&utm_medium=email&book=1"],
    ]);
    // Every destination reads back as the source it was made for.
    for (const link of SHORT_LINKS) {
      expect(arrivalSourceFromSearch(shortLinkDestination(link).slice(1))).toBe(link.source);
    }
  });

  it("opens the booking form only for the book-again link, and drops the flag after", () => {
    expect(wantsBookingOpen("?utm_source=rebook&utm_medium=email&book=1")).toBe(true);
    expect(wantsBookingOpen("?utm_source=instagram&utm_medium=bio")).toBe(false);
    expect(wantsBookingOpen("?book=yes")).toBe(false);
    expect(withoutBookingFlag("/", "?utm_source=rebook&utm_medium=email&book=1", "")).toBe(
      "/?utm_source=rebook&utm_medium=email"
    );
    expect(withoutBookingFlag("/", "?book=1", "#lessons")).toBe("/#lessons");
  });

  it("accepts only the closed set", () => {
    expect(isArrivalSource("instagram")).toBe(true);
    expect(isArrivalSource("toString")).toBe(false);
    expect(isArrivalSource("Instagram")).toBe(false);
    expect(isArrivalSource(undefined)).toBe(false);
    expect(arrivalSourceFromSearch("?utm_source=<script>")).toBeNull();
    expect(arrivalSourceFromSearch("")).toBeNull();
  });

  it("remembers a tagged arrival for the tab, and an untagged page keeps it", () => {
    rememberArrivalSource("?utm_source=tiktok&utm_medium=bio");
    rememberArrivalSource("");
    expect(recalledArrivalSource()).toBe("tiktok");

    rememberArrivalSource("?utm_source=card");
    expect(recalledArrivalSource()).toBe("card");
  });

  it("ignores a value someone edited in storage", () => {
    window.sessionStorage.setItem("dm_arrival_source", "anything");
    expect(recalledArrivalSource()).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    // Shadow the accessor, wherever jsdom defines it, then put it back.
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(() => rememberArrivalSource("?utm_source=instagram")).not.toThrow();
      expect(recalledArrivalSource()).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, "sessionStorage", original);
      else delete (window as { sessionStorage?: Storage }).sessionStorage;
    }
  });

  it("names an untagged booking plainly instead of guessing", () => {
    expect(arrivalSourceLabel("instagram")).toBe("Instagram bio link");
    expect(arrivalSourceLabel(null)).toBe("No tagged link");
  });
});
