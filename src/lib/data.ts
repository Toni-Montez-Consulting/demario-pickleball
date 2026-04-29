import { addDays } from "@/lib/time";

export interface Review {
  quote: string;
  accentWord: string | null;
  name: string;
  meta: string;
  initial: string;
  tag: string;
  takeaway: string;
}

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
  steps: LessonStep[];
}

export type LessonKey = "beginner" | "advanced" | "clinic";

export const REVIEWS: Review[] = [
  {
    quote:
      "DeMario doesn't just teach you how to hit the ball — he teaches you how to think the point. Two months in and I'm reading opponents in a way I never could before.",
    accentWord: "think the point",
    name: "Rachel K.",
    meta: "Intermediate · 12 lessons",
    initial: "R",
    tag: "Strategy",
    takeaway: "Better point construction",
  },
  {
    quote:
      "Most coaches feed you balls for an hour. DeMario built a real plan around my weak spots. My DUPR jumped 0.4 in a season.",
    accentWord: null,
    name: "Marcus T.",
    meta: "Competitive · 20 lessons",
    initial: "M",
    tag: "Competitive",
    takeaway: "Targeted practice plan",
  },
  {
    quote:
      "I was the person dinking into the net every point. After four sessions I played my first tournament — and won my first match.",
    accentWord: null,
    name: "Jenna P.",
    meta: "Beginner · 6 lessons",
    initial: "J",
    tag: "Beginner",
    takeaway: "First tournament confidence",
  },
];

export const LESSONS: Record<LessonKey, Lesson> = {
  beginner: {
    name: "Foundations",
    desc: "For new players and anyone under 3.5 DUPR.",
    price: "$70",
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
    price: "$80",
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
    desc: "Small-group. 3–4 players, 90 minutes, sharp focus.",
    price: "$50",
    per: "per player",
    steps: [
      { t: "0:00", h: "Rotation warm-up", p: "Everyone moves, everyone hits. No standing around." },
      { t: "0:15", h: "Themed block", p: "Weekly topic — resets, stacking, poaching, or serve+3." },
      { t: "0:45", h: "Competitive drills", p: "King-of-the-court style. Pressure with purpose." },
      { t: "1:15", h: "Open play + coaching", p: "Real games. I rotate between courts giving cues." },
    ],
  },
};

export interface DaySlot {
  d: string;
  n: number;
  dateStr: string;
}

const BOOKING_TIME_ZONE = "America/Chicago";

function dateStringInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function generateDays(now = new Date(), timeZone = BOOKING_TIME_ZONE): DaySlot[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result: DaySlot[] = [];
  const today = dateStringInTimeZone(now, timeZone);
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
