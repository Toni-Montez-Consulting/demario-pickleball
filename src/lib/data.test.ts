import { describe, expect, it } from "vitest";
import { generateDays } from "./data";

describe("generateDays", () => {
  it("uses the Dallas booking timezone instead of the visitor machine timezone", () => {
    const days = generateDays(new Date("2026-04-29T04:30:00.000Z"));

    expect(days[0]).toEqual({
      d: "Wed",
      n: 29,
      dateStr: "2026-04-29",
    });
    expect(days).toHaveLength(30);
  });
});
