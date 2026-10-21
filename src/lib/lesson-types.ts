import {
  GROUP_SIZE_LIMITS,
  quoteSession,
  type DrillLength,
  type SessionFormat,
  type SessionQuote,
} from "@/lib/session-pricing";

/**
 * Every value bookings.lesson_type can hold, and the one place each is named.
 * The database mirrors this list in bookings_lesson_type_check and
 * booking_duration() (docs/supabase-round-2-sessions-migration.sql), and
 * lesson-types.test.ts fails when the two drift.
 *
 * A drilling session's length is part of its type, so the database's
 * booking_duration(lesson_type) and the overlap constraint built on it work
 * unchanged.
 */
export const LESSON_TYPES = ["beginner", "advanced", "clinic", "drill_60", "drill_90", "play_pro"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const LESSON_NAMES: Record<LessonType, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
  drill_60: "Drilling Session, 60 min",
  drill_90: "Drilling Session, 90 min",
  play_pro: "Play with the Pro",
};

/**
 * Fees in whole dollars for the three original lessons: per session, except
 * the clinic, which is per player. The group formats are quoted from
 * session-pricing.ts instead.
 */
export const LESSON_FEES = { beginner: 70, advanced: 80, clinic: 50 } as const;

/** A fixed-fee lesson's fee in whole dollars, or null for a group format or an unknown value. */
export function fixedFee(type: string): number | null {
  if (!isLessonType(type) || !(type in LESSON_FEES)) return null;
  return LESSON_FEES[type as keyof typeof LESSON_FEES];
}

/** The group formats, and the price table each one quotes from. */
const GROUP_FORMATS: { [T in LessonType]?: { format: SessionFormat; length?: DrillLength } } = {
  drill_60: { format: "drill", length: 60 },
  drill_90: { format: "drill", length: 90 },
  play_pro: { format: "play_pro" },
};

export function isLessonType(value: unknown): value is LessonType {
  return typeof value === "string" && (LESSON_TYPES as readonly string[]).includes(value);
}

export function isGroupLessonType(type: LessonType): boolean {
  return GROUP_FORMATS[type] !== undefined;
}

/** The player limits for a group format, or null for a fixed-fee lesson. */
export function groupSizeLimits(type: LessonType): { min: number; max: number } | null {
  const group = GROUP_FORMATS[type];
  return group ? GROUP_SIZE_LIMITS[group.format] : null;
}

/**
 * The coaching quote for a group format, or null for a fixed-fee lesson.
 * Throws RangeError for a group size outside the format's limits.
 */
export function quoteLesson(type: LessonType, groupSize: number): SessionQuote | null {
  const group = GROUP_FORMATS[type];
  return group ? quoteSession(group.format, groupSize, group.length) : null;
}

/** A booking's lesson name. A value this code does not know is shown as stored, never hidden. */
export function lessonName(type: string): string {
  return isLessonType(type) ? LESSON_NAMES[type] : type;
}

/** The quote columns a group booking stores, in whole cents. */
export interface StoredQuote {
  group_size?: number | null;
  quoted_per_person_cents?: number | null;
  quoted_total_cents?: number | null;
}

/**
 * A quote as the bookings columns store it. The total is built from the stored
 * per-person cents, so it always equals per person times players, which the
 * database checks.
 */
export function quoteColumns(quote: SessionQuote): {
  group_size: number;
  quoted_per_person_cents: number;
  quoted_total_cents: number;
} {
  const perPersonCents = Math.round(quote.perPerson * 100);
  return {
    group_size: quote.groupSize,
    quoted_per_person_cents: perPersonCents,
    quoted_total_cents: perPersonCents * quote.groupSize,
  };
}

/**
 * The quote a booking stored at booking time, in dollars, or null for a booking
 * without one. The database requires all three columns on every group booking
 * and none on the others (bookings_group_quote_check).
 */
export function storedQuote(
  booking: StoredQuote
): { groupSize: number; perPerson: number; total: number } | null {
  const { group_size, quoted_per_person_cents, quoted_total_cents } = booking;
  if (group_size == null || quoted_per_person_cents == null || quoted_total_cents == null) return null;
  return { groupSize: group_size, perPerson: quoted_per_person_cents / 100, total: quoted_total_cents / 100 };
}
