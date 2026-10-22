import { describe, expect, it } from "vitest";
import { generateDays } from "./data";

describe("generateDays", () => {
  it("uses the Dallas booking timezone instead of the visitor machine timezone", () => {
    const days = generateDays(new Date("2026-04-29T04:30:00.000Z"));

    expect(days[0]).toEqual({
      d: "Wed",
      n: 29,
      m: "Apr",
      label: "Wednesday, April 29",
      dateStr: "2026-04-29",
    });
    expect(days).toHaveLength(30);
  });

  // February is short, so a 30-day strip repeats day numbers a month apart on
  // the same weekday. Only the month tells "Sun 21" from "Sun 21".
  it("tells apart two days with the same weekday and number", () => {
    const days = generateDays(new Date("2027-02-20T18:00:00.000Z"));
    const sundays21 = days.filter((day) => day.d === "Sun" && day.n === 21);
    expect(sundays21.map((day) => `${day.m} ${day.n}`)).toEqual(["Feb 21", "Mar 21"]);
    expect(new Set(days.map((day) => day.label)).size).toBe(days.length);
  });
});
