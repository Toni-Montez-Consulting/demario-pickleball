import { describe, expect, it } from "vitest";
import { dateInTimeZone, lessonHasStarted, zonedDateTimeToUtc } from "./time";

describe("lessonHasStarted", () => {
  // 2026-10-19 is daylight time in Chicago, UTC-5.
  const now = new Date("2026-10-19T15:00:00Z"); // 10:00 AM Central

  it("compares the lesson's start in Central time with now", () => {
    expect(lessonHasStarted("2026-10-19", "9:00 AM", now)).toBe(true);
    expect(lessonHasStarted("2026-10-19", "10:00 AM", now)).toBe(true);
    expect(lessonHasStarted("2026-10-19", "11:00 AM", now)).toBe(false);
    expect(lessonHasStarted("2026-10-18", "6:00 PM", now)).toBe(true);
    expect(lessonHasStarted("2026-10-20", "7:00 AM", now)).toBe(false);
  });

  it("treats a time it cannot read as not started", () => {
    expect(lessonHasStarted("2020-01-01", "sometime", now)).toBe(false);
  });
});

describe("dateInTimeZone", () => {
  it("returns the Central date, not the UTC one, late in the evening", () => {
    // 03:00 UTC on the 19th is 10:00 PM on the 18th in Dallas (CDT).
    expect(dateInTimeZone(new Date("2026-10-19T03:00:00Z"))).toBe("2026-10-18");
    expect(dateInTimeZone(new Date("2026-10-19T05:00:00Z"))).toBe("2026-10-19");
  });

  it("follows the winter offset after DST ends", () => {
    // 05:30 UTC on Nov 2 is 11:30 PM on Nov 1 in Dallas (CST, UTC-6).
    expect(dateInTimeZone(new Date("2026-11-02T05:30:00Z"))).toBe("2026-11-01");
  });
});

describe("zonedDateTimeToUtc", () => {
  const at = (date: string, hour: number, minute = 0) =>
    zonedDateTimeToUtc(date, { hour, minute }).toISOString();

  it("converts Central wall-clock times on ordinary days", () => {
    expect(at("2026-10-22", 9)).toBe("2026-10-22T14:00:00.000Z"); // CDT, UTC-5
    expect(at("2026-12-01", 9)).toBe("2026-12-01T15:00:00.000Z"); // CST, UTC-6
  });

  // A single pass read the offset on the wrong side of the overnight switch.
  it("uses daylight time for a morning slot on the day it starts", () => {
    expect(at("2027-03-14", 7)).toBe("2027-03-14T12:00:00.000Z");
    expect(at("2027-03-14", 8)).toBe("2027-03-14T13:00:00.000Z");
    expect(at("2027-03-14", 17, 30)).toBe("2027-03-14T22:30:00.000Z");
  });

  it("uses standard time for an early slot on the day daylight time ends", () => {
    expect(at("2026-11-01", 6)).toBe("2026-11-01T12:00:00.000Z");
    expect(at("2026-11-01", 7)).toBe("2026-11-01T13:00:00.000Z");
    expect(at("2026-11-01", 20)).toBe("2026-11-02T02:00:00.000Z");
  });

  it("marks a 7:00 AM lesson on that March Sunday as started only at 7:00 CDT", () => {
    expect(lessonHasStarted("2027-03-14", "7:00 AM", new Date("2027-03-14T11:59:00Z"))).toBe(false);
    expect(lessonHasStarted("2027-03-14", "7:00 AM", new Date("2027-03-14T12:00:00Z"))).toBe(true);
  });
});
