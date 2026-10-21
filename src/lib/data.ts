import { addDays, dateInTimeZone } from "@/lib/time";
import { LESSON_FEES } from "@/lib/lesson-types";
import { lowestPerPerson, soloPrice, usd, type SessionFormat } from "@/lib/session-pricing";

export interface LessonStep {
  t: string;
  h: string;
  p: string;
}

export interface Lesson {
  name: string;
  desc: string;
  price: string;
  per: string;
  /** A second price line, under `per`. */
  from?: string;
  /** A single lesson's timeline. */
  steps?: LessonStep[];
  /** A group format shows its price table instead of a timeline. */
  priceTable?: SessionFormat;
}

/**
 * The lesson cards, and the format a student picks first in the booking form.
 * "drill" becomes drill_60 or drill_90 once a length is chosen.
 */
export type LessonKey = "beginner" | "advanced" | "clinic" | "drill" | "play_pro";

// Reviews now live in the database and are served by /api/reviews/published.
// The seven previously hardcoded here and in Testimonials.tsx were migrated in
// docs/supabase-students-reviews-migration.sql with source = 'legacy'.

export const LESSONS: Record<LessonKey, Lesson> = {
  beginner: {
    name: "Foundations",
    desc: "For new players and anyone under 3.5 DUPR.",
    price: usd(LESSON_FEES.beginner),
    per: "per hour",
    steps: [
      { t: "0:00", h: "Warm-up + assessment", p: "Quick rally to calibrate where you're at today." },
      { t: "0:10", h: "Technique block", p: "One focus: dink, drive, serve, or return. Filmed for review." },
      { t: "0:30", h: "Live drills", p: "Game-speed reps. I feed, you execute, we adjust." },
      { t: "0:50", h: "Mini-match", p: "Put it into a real point. Coached in real-time." },
      { t: "0:55", h: "Debrief + homework", p: "Two specific things to practice before next session." },
    ],
  },
  advanced: {
    name: "Strategy Lab",
    desc: "For 3.5+ players ready to level up their thinking.",
    price: usd(LESSON_FEES.advanced),
    per: "per session",
    steps: [
      { t: "0:00", h: "Film review", p: "We watch 5 minutes of your last match. Patterns, leaks, tells." },
      { t: "0:15", h: "Tactical concept", p: "One theme per lesson: resets, stacking, third-shot strategy." },
      { t: "0:30", h: "Situational drills", p: "Re-create the scenarios you lose. Solve them live." },
      { t: "0:50", h: "Scouted match play", p: "I play you. Probing your weaknesses so you can patch them." },
      { t: "1:05", h: "Game plan", p: "Written notes + a tournament-ready mental checklist." },
    ],
  },
  clinic: {
    name: "Group Clinic",
    desc: "Small-group. 90 minutes, 3–4 players. One person books the session, then tells DeMario who else is coming.",
    price: usd(LESSON_FEES.clinic),
    per: "per player",
    steps: [
      { t: "0:00", h: "Rotation warm-up", p: "Everyone moves, everyone hits. No standing around." },
      { t: "0:15", h: "Themed block", p: "Weekly topic — resets, stacking, poaching, or serve+3." },
      { t: "0:45", h: "Competitive drills", p: "King-of-the-court style. Pressure with purpose." },
      { t: "1:15", h: "Open play + coaching", p: "Real games. I rotate between courts giving cues." },
    ],
  },
  // The descriptions are DeMario's, approved as written on 2026-10-20. Prices
  // come from his table in session-pricing.ts.
  drill: {
    name: "Drilling Session",
    desc: "Reps on the shots you want to sharpen, for 1 to 8 players. 60 or 90 minutes, and one person books and pays for the group.",
    price: usd(soloPrice("drill")),
    per: "solo",
    from: `from ${usd(lowestPerPerson("drill"))} per player`,
    priceTable: "drill",
  },
  play_pro: {
    name: "Play with the Pro",
    desc: "Real games with DeMario as a partner or opponent, for 1 to 4 players. One to two hours, same price either way.",
    price: usd(soloPrice("play_pro")),
    per: "solo",
    from: `from ${usd(lowestPerPerson("play_pro"))} per player`,
    priceTable: "play_pro",
  },
};

export interface DaySlot {
  d: string;
  n: number;
  dateStr: string;
}

const BOOKING_TIME_ZONE = "America/Chicago";

export function generateDays(now = new Date(), timeZone = BOOKING_TIME_ZONE): DaySlot[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result: DaySlot[] = [];
  const today = dateInTimeZone(now, timeZone);
  for (let i = 1; i <= 30; i++) {
    const dateStr = addDays(today, i);
    const date = new Date(`${dateStr}T00:00:00Z`);
    result.push({
      d: days[date.getUTCDay()],
      n: date.getUTCDate(),
      dateStr,
    });
  }
  return result;
}
