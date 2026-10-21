import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LESSON_DURATION_MINUTES } from "./business";
import { LESSONS } from "./data";
import {
  fixedFee,
  groupSizeLimits,
  isLessonType,
  lessonName,
  LESSON_TYPES,
  quoteColumns,
  quoteLesson,
  storedQuote,
} from "./lesson-types";
import { GROUP_SIZE_LIMITS, quoteSession } from "./session-pricing";

// Vitest runs from the repo root, as `npm run test` does in CI.
const migration = readFileSync(
  path.join(process.cwd(), "docs/supabase-round-2-sessions-migration.sql"),
  "utf8"
);

describe("the database mirrors the lesson types", () => {
  it("allows exactly LESSON_TYPES in bookings_lesson_type_check", () => {
    const match = migration.match(
      /add constraint bookings_lesson_type_check\s+check \(lesson_type in \(([^)]*)\)\)/
    );
    expect(match, "the CHECK constraint was not found").not.toBeNull();
    const allowed = [...match![1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
    expect(allowed).toEqual([...LESSON_TYPES]);
  });

  it("gives booking_duration() the same minutes as LESSON_DURATION_MINUTES", () => {
    const body = migration.match(/function public\.booking_duration[\s\S]*?\$\$([\s\S]*?)\$\$/);
    expect(body, "booking_duration() was not found").not.toBeNull();
    const durations = Object.fromEntries(
      [...body![1].matchAll(/when '([a-z0-9_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])])
    );
    expect(durations).toEqual(LESSON_DURATION_MINUTES);
    expect(Object.keys(LESSON_DURATION_MINUTES).sort()).toEqual([...LESSON_TYPES].sort());
  });

  it("caps group sizes in the database where session-pricing.ts caps them", () => {
    expect(migration).toContain(
      `group_size <= (case when lesson_type = 'play_pro' then ${GROUP_SIZE_LIMITS.play_pro.max} else ${GROUP_SIZE_LIMITS.drill.max} end)`
    );
  });
});

describe("lesson types", () => {
  it("prices every type one way: a fixed fee or a group quote, never both or neither", () => {
    for (const type of LESSON_TYPES) {
      const fixed = fixedFee(type) !== null;
      const group = groupSizeLimits(type) !== null;
      expect(fixed !== group, type).toBe(true);
    }
  });

  it("quotes drilling by its length and Play with the Pro from its own table", () => {
    expect(quoteLesson("drill_60", 3)).toEqual(quoteSession("drill", 3, 60));
    expect(quoteLesson("drill_90", 3)).toEqual(quoteSession("drill", 3, 90));
    expect(quoteLesson("play_pro", 2)).toMatchObject({ perPerson: 40, total: 80 });
    expect(quoteLesson("beginner", 1)).toBeNull();
    expect(() => quoteLesson("play_pro", 5)).toThrow(RangeError);
  });

  it("recognizes only the stored values", () => {
    expect(isLessonType("drill_90")).toBe(true);
    expect(isLessonType("drill")).toBe(false);
    expect(isLessonType("constructor")).toBe(false);
    expect(fixedFee("constructor")).toBeNull();
    expect(fixedFee("clinic")).toBe(50);
  });

  it("shows a value it does not know as stored, never blank", () => {
    expect(lessonName("drill_90")).toBe("Drilling Session, 90 min");
    expect(lessonName("mystery")).toBe("mystery");
  });
});

describe("stored quotes", () => {
  it("stores whole cents, with the total built from the per-person price", () => {
    expect(quoteColumns(quoteSession("drill", 3, 90))).toEqual({
      group_size: 3,
      quoted_per_person_cents: 3500,
      quoted_total_cents: 10500,
    });
  });

  it("reads a stored quote back in dollars", () => {
    expect(
      storedQuote({ group_size: 3, quoted_per_person_cents: 3500, quoted_total_cents: 10500 })
    ).toEqual({ groupSize: 3, perPerson: 35, total: 105 });
  });

  it("has no quote for a booking without all three columns", () => {
    expect(storedQuote({})).toBeNull();
    expect(storedQuote({ group_size: 3, quoted_per_person_cents: null, quoted_total_cents: 10500 })).toBeNull();
  });
});

describe("lesson cards", () => {
  // DeMario approved these lines as written on 2026-10-20. The card builds
  // them from his price table, so a price change shows here first.
  it("prints DeMario's approved price lines from the table", () => {
    expect(`${LESSONS.drill.price} ${LESSONS.drill.per}, ${LESSONS.drill.from}.`).toBe(
      "$60 solo, from $15 per player."
    );
    expect(`${LESSONS.play_pro.price} ${LESSONS.play_pro.per}, ${LESSONS.play_pro.from}.`).toBe(
      "$70 solo, from $30 per player."
    );
  });

  it("keeps the Group Clinic as it was", () => {
    expect(LESSONS.clinic).toMatchObject({ name: "Group Clinic", price: "$50", per: "per player" });
    expect(LESSON_DURATION_MINUTES.clinic).toBe(90);
  });
});
