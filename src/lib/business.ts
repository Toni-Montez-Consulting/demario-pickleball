import type { LessonType } from "@/lib/lesson-types";

export const COACH_NAME = "DeMario Montez";
export const COACH_EMAIL = "demariomontez10@gmail.com";
export const COACH_PHONE_DISPLAY = "(469) 371-9220";
export const COACH_PHONE_TEL = "4693719220";

// Independent review source shown on the homepage. Self-collected reviews do
// not earn stars in search, so the public proof is a link to where students
// rated DeMario on someone else's platform.
export const TEACHMETO_REVIEWS_URL =
  "https://teachme.to/listings/pickleball/pickleball-with-demario-montez#reviews";

export const LESSON_LOCATION =
  process.env.NEXT_PUBLIC_LESSON_LOCATION?.trim() ||
  "Court confirmed by Mario after booking";

export const COURT_CONFIRMATION_MESSAGE =
  "Mario will confirm the exact court after booking based on your preference, court availability, weather, and any court fee.";

// Stored on every booking as the terms the student accepted, so it names exactly
// one text: docs/terms/<version>.txt. A test fails if the terms change without it.
export const WAIVER_VERSION = "2026-10-24";

// The database's booking_duration() mirrors these for the overlap constraint
// (docs/supabase-round-2-sessions-migration.sql); lesson-types.test.ts checks
// that the two match. Play with the Pro runs one to two hours at one price and
// blocks one: DeMario extends a longer session on his own calendar.
export const LESSON_DURATION_MINUTES: Record<string, number> = {
  beginner: 60,
  advanced: 75,
  clinic: 90,
  drill_60: 60,
  drill_90: 90,
  play_pro: 60,
} satisfies Record<LessonType, number>;
