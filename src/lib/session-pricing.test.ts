import { describe, it, expect } from "vitest";
import { GROUP_SIZE_LIMITS, quoteSession } from "./session-pricing";

// DeMario's prices, 2026-10-20, copied from his texts. A change to the table
// should fail here first.
const DRILL_60 = { 1: 60, 2: 30, 3: 25, 4: 20, 5: 18, 6: 15, 7: 15, 8: 15 };
const DRILL_90 = { 1: 80, 2: 40, 3: 35, 4: 30, 5: 25, 6: 22, 7: 20, 8: 18 };
const PLAY_PRO_TOTALS = { 1: 70, 2: 80, 3: 105, 4: 120 };

describe("quoteSession", () => {
  it("prices every 60-minute drilling group size as DeMario set it", () => {
    for (const [size, perPerson] of Object.entries(DRILL_60)) {
      const quote = quoteSession("drill", Number(size), 60);
      expect(quote.perPerson, `60 min, ${size} players`).toBe(perPerson);
      expect(quote.total).toBe(perPerson * Number(size));
    }
  });

  it("prices every 90-minute drilling group size as DeMario set it", () => {
    for (const [size, perPerson] of Object.entries(DRILL_90)) {
      expect(quoteSession("drill", Number(size), 90).perPerson, `90 min, ${size} players`).toBe(perPerson);
    }
  });

  it("matches DeMario's stated Play with the Pro totals", () => {
    for (const [size, total] of Object.entries(PLAY_PRO_TOTALS)) {
      expect(quoteSession("play_pro", Number(size)).total, `${size} players`).toBe(total);
    }
  });

  it("caps group sizes at eight for drilling and four for Play with the Pro", () => {
    expect(GROUP_SIZE_LIMITS.drill).toEqual({ min: 1, max: 8 });
    expect(GROUP_SIZE_LIMITS.play_pro).toEqual({ min: 1, max: 4 });
    expect(() => quoteSession("drill", 9, 60)).toThrow(RangeError);
    expect(() => quoteSession("play_pro", 5)).toThrow(RangeError);
    expect(() => quoteSession("drill", 0, 60)).toThrow(RangeError);
    expect(() => quoteSession("play_pro", 2.5)).toThrow(RangeError);
  });

  it("refuses a drilling session without a 60 or 90 minute length", () => {
    expect(() => quoteSession("drill", 2)).toThrow(/60 or 90 minutes/);
    // A length from outside the type, as a malformed request could send it.
    expect(() => quoteSession("drill", 2, 75 as unknown as 60)).toThrow(/60 or 90 minutes/);
  });
});
