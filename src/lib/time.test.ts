import { describe, expect, it } from "vitest";
import { dateInTimeZone } from "./time";

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
