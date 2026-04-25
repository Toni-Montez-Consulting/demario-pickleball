"use client";

import { useState, useRef } from "react";

interface RoadmapItem {
  key: string;
  text: string;
  detail?: string;
}

interface RoadmapPhase {
  phase: string;
  title: string;
  timeframe: string;
  items: RoadmapItem[];
}

const PHASES: RoadmapPhase[] = [
  {
    phase: "Phase 0",
    title: "Legal & Financial Foundation",
    timeframe: "Do these first",
    items: [
      {
        key: "p0-llc",
        text: "Register as a sole proprietor or LLC in Texas (Texas SOS website)",
        detail: "Separates your personal assets from business liability — essential before taking paying clients.",
      },
      {
        key: "p0-ein",
        text: "Apply for a free EIN at IRS.gov — takes 5 minutes online",
        detail: "Required to open a business bank account and file taxes as a business.",
      },
      {
        key: "p0-bank",
        text: "Open a separate business checking account",
        detail: "Keeps personal and business money separate. Makes tax time simple and audit-proof.",
      },
      {
        key: "p0-insurance",
        text: "Get general liability insurance for coaching ($20–40/mo via Next Insurance or USPTA)",
        detail: "One injury claim without coverage could cost tens of thousands. Non-negotiable for a solo coach.",
      },
      {
        key: "p0-waiver-review",
        text: "Have a Texas sports/recreation attorney review the coaching waiver and terms",
        detail: "The site can collect agreement, but the final release language should come from a qualified attorney and be checked against your insurance requirements.",
      },
      {
        key: "p0-venue",
        text: "Confirm where direct site bookings can run before taking live bookings",
        detail: "Get written approval from the venue, confirm court fees, cancellation rules, and whether they require their own waiver or insurance certificate.",
      },
      {
        key: "p0-taxes",
        text: "Set aside 25–30% of every payment for self-employment taxes",
        detail: "SE tax is ~15.3% on top of income tax. Coaches get hit hard at year-end if unprepared.",
      },
      {
        key: "p0-accounting",
        text: "Set up a spreadsheet (or Wave, free) to log every dollar in and out",
        detail: "You can't optimize what you don't track. Takes 10 minutes a week.",
      },
    ],
  },
  {
    phase: "Phase 1",
    title: "Digital Presence",
    timeframe: "Months 1–2",
    items: [
      {
        key: "p1-google-biz",
        text: "Claim and verify your Google Business Profile at business.google.com",
        detail: "Shows up when people search 'pickleball coach Dallas' — free and high-impact.",
      },
      {
        key: "p1-google-reviews",
        text: "Ask your first 10 students for a Google review (send them a direct link via text)",
        detail: "10+ reviews makes you look established. Most students will do it if you just ask.",
      },
      {
        key: "p1-instagram",
        text: "Post to Instagram (@Alexanderiio) 3x/week — drills, tips, court moments",
        detail: "Consistency matters more than perfection. Short clips of real reps outperform polished content.",
      },
      {
        key: "p1-tiktok",
        text: "Post to TikTok (@DemarioMontez) 3x/week — 'fix this mistake' style clips",
        detail: "TikTok's algorithm gives new accounts real reach. One clip can bring 10 new students.",
      },
      {
        key: "p1-dipc-listing",
        text: "Ask Dallas Indoor PBC to list you on their website as Head Pro",
        detail: "Their site traffic is warm leads — people already at the club looking for instruction.",
      },
      {
        key: "p1-email-list",
        text: "Start an email list with Mailchimp (free up to 500 contacts)",
        detail: "You own your email list. Algorithms change — your list doesn't.",
      },
      {
        key: "p1-linktree",
        text: "Add a link-in-bio on Instagram and TikTok pointing to your booking site",
        detail: "Every piece of content you make is a funnel. Make sure the funnel goes somewhere.",
      },
    ],
  },
  {
    phase: "Phase 2",
    title: "Booking & Payments",
    timeframe: "Months 1–3",
    items: [
      {
        key: "p2-stripe",
        text: "Connect Stripe to this site to collect payment upfront at booking",
        detail: "Eliminates no-shows. Anyone who paid is showing up.",
      },
      {
        key: "p2-email-confirm",
        text: "Set up automatic email confirmations sent to student + yourself after every booking",
        detail: "Professionalism that takes 30 minutes to set up but runs forever.",
      },
      {
        key: "p2-packages",
        text: "Create lesson packages (3-pack, 5-pack) at a small discount to lock in repeat students",
        detail: "A 3-pack commitment turns a one-time student into a regular. LTV matters more than rate.",
      },
      {
        key: "p2-cancel-policy",
        text: "Text every new student your 24-hour cancellation policy before their first session",
        detail: "Set expectations early. Most people respect it — and the few who don't need to know.",
      },
    ],
  },
  {
    phase: "Phase 3",
    title: "Revenue Diversification",
    timeframe: "Months 3–6",
    items: [
      {
        key: "p3-clinic-schedule",
        text: "Launch a fixed weekly or bi-weekly group clinic (set day/time, make it recurring)",
        detail: "Group clinics are your highest revenue-per-hour format. 4 students × $50 = $200/hr.",
      },
      {
        key: "p3-content-series",
        text: "Start a 'Fix Your Game' short-video series — one common mistake per week",
        detail: "Positions you as the expert. Each video is a permanent lead generation asset.",
      },
      {
        key: "p3-free-consult",
        text: "Offer a free 15-minute intro call as a lead magnet for people on the fence",
        detail: "Lowers the barrier to try. Most people who show up for the call end up booking.",
      },
      {
        key: "p3-referral-promo",
        text: "Run a 'bring a friend' intro lesson promotion — fills your calendar fast",
        detail: "Your current students know people exactly like them. Tap that network.",
      },
      {
        key: "p3-gift-cards",
        text: "Offer lesson gift cards — sells well around holidays",
        detail: "Easy revenue spike with zero extra coaching time.",
      },
    ],
  },
  {
    phase: "Phase 4",
    title: "Systems & Business Health",
    timeframe: "Months 6–12",
    items: [
      {
        key: "p4-monthly-pnl",
        text: "Review monthly revenue, expenses, and net profit — even 10 minutes counts",
        detail: "Most solo coaches don't know what they actually earn. Know your number.",
      },
      {
        key: "p4-quarterly-taxes",
        text: "Pay estimated quarterly taxes (due: Apr 15, Jun 16, Sep 15, Jan 15)",
        detail: "Missing these triggers penalties. Set a calendar reminder now.",
      },
      {
        key: "p4-second-coach",
        text: "Find and vet a second coach to handle overflow group clinics",
        detail: "Your earning cap right now is your hours. A second coach breaks that ceiling.",
      },
      {
        key: "p4-curriculum",
        text: "Build a structured 4-week beginner curriculum with written drill progressions",
        detail: "A curriculum makes your coaching scalable, repeatable, and more valuable.",
      },
      {
        key: "p4-testimonials",
        text: "Collect video testimonials from your 3 best students",
        detail: "Video converts better than text. One 30-second clip from a real student is worth 10 written reviews.",
      },
      {
        key: "p4-crm",
        text: "Start a simple student CRM — name, level, goals, last session notes (Notion or a spreadsheet)",
        detail: "Remembering what each student is working on is the difference between good coaching and great coaching.",
      },
    ],
  },
  {
    phase: "Phase 5",
    title: "Long-term Growth",
    timeframe: "Year 2+",
    items: [
      {
        key: "p5-video-course",
        text: "Launch a paid video course or membership ($15–29/mo via Skool or Kajabi)",
        detail: "Digital income that doesn't require your time. Scales infinitely.",
      },
      {
        key: "p5-sponsorship",
        text: "Reach out to Selkirk, Franklin, or Joola for a gear/sponsorship deal",
        detail: "At your level and with a real following, brands will work with you. Ask.",
      },
      {
        key: "p5-tournament-pkg",
        text: "Offer a tournament coaching package — scout opponents, travel, courtside coaching",
        detail: "Premium offer for serious players. High ticket, high value, and differentiates you from every other coach.",
      },
      {
        key: "p5-coach-team",
        text: "Build a team of coaches under the DeMario Montez brand",
        detail: "Your brand becomes the business — you stop trading time for money.",
      },
      {
        key: "p5-speaking",
        text: "Run a workshop at a local pickleball club or corporate wellness event",
        detail: "Expands your reach outside of one-on-one. One workshop can fill your calendar for a month.",
      },
    ],
  },
];

const TOTAL_ITEMS = PHASES.reduce((sum, p) => sum + p.items.length, 0);
const VALID_KEYS = new Set(PHASES.flatMap((p) => p.items.map((item) => item.key)));

export default function RoadmapDashboard({ initialChecked }: { initialChecked: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(
    new Set(initialChecked.filter((key) => VALID_KEYS.has(key)))
  );
  const pendingRef = useRef(new Set<string>());

  async function toggle(key: string) {
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    const next = !checked.has(key);
    setChecked((prev) => {
      const s = new Set(prev);
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });
    try {
      const res = await fetch(`/api/roadmap/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: next }),
      });
      if (!res.ok) {
        setChecked((prev) => {
          const s = new Set(prev);
          if (next) s.delete(key);
          else s.add(key);
          return s;
        });
      }
    } finally {
      pendingRef.current.delete(key);
    }
  }

  const totalDone = checked.size;
  const overallPct = TOTAL_ITEMS > 0 ? (totalDone / TOTAL_ITEMS) * 100 : 0;

  return (
    <div className="admin-wrap roadmap-wrap">
      <div className="roadmap-header">
        <div className="admin-header">
          <h1>Business Roadmap</h1>
          <span className="admin-count">{totalDone} / {TOTAL_ITEMS} complete</span>
        </div>
        <p className="roadmap-sub">
          Your step-by-step guide from zero to a real coaching business. Work through these in order — earlier phases unlock the value of later ones.
        </p>
        <div className="overall-bar">
          <div className="overall-fill" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {PHASES.map((phase) => {
        const phaseDone = phase.items.filter((it) => checked.has(it.key)).length;
        const phasePct = phase.items.length > 0 ? (phaseDone / phase.items.length) * 100 : 0;
        return (
          <div key={phase.phase} className="roadmap-phase">
            <div className="phase-header">
              <div className="phase-meta">
                <span className="phase-badge">{phase.phase}</span>
                <span className="phase-timeframe">{phase.timeframe}</span>
              </div>
              <div className="phase-title-row">
                <h2 className="phase-title">{phase.title}</h2>
                <span className="phase-count">{phaseDone}/{phase.items.length}</span>
              </div>
              <div className="phase-bar">
                <div className="phase-fill" style={{ width: `${phasePct}%` }} />
              </div>
            </div>
            <div className="roadmap-items" role="group">
              {phase.items.map((item) => {
                const done = checked.has(item.key);
                return (
                  <div
                    key={item.key}
                    role="checkbox"
                    aria-checked={done ? "true" : "false"}
                    tabIndex={0}
                    className={`roadmap-item${done ? " done" : ""}`}
                    onClick={() => toggle(item.key)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        toggle(item.key);
                      }
                    }}
                  >
                    <div className="item-check" aria-hidden="true">
                      <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 5 4.5 8.5 11 1" />
                      </svg>
                    </div>
                    <div className="item-content">
                      <div className="item-text">{item.text}</div>
                      {item.detail && <div className="item-detail">{item.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
