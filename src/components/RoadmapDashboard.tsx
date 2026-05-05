"use client";

import { useState } from "react";
import QuickAddTask from "@/components/QuickAddTask";

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
        text: "Decide whether to operate as an LLC or sole proprietor",
        detail: "Mario task: ask a Texas CPA or attorney which setup fits you. If they recommend an LLC, file it through the Texas Secretary of State and save the approval document. Done when you know the legal business name the site should use.",
      },
      {
        key: "p0-ein",
        text: "Apply for a free EIN at IRS.gov — takes 5 minutes online",
        detail: "Mario task: go to IRS.gov, apply for an EIN for the coaching business, download the confirmation PDF, and save it somewhere safe. You will need it for banking, taxes, and payment processors.",
      },
      {
        key: "p0-bank",
        text: "Open a separate business checking account",
        detail: "Mario task: after the EIN/business setup is ready, open a checking account used only for coaching money. Done when lesson payments and coaching expenses stop mixing with personal spending.",
      },
      {
        key: "p0-insurance",
        text: "Save the active coaching liability insurance certificate",
        detail: "Mario task: save the active coaching liability insurance certificate in a known folder. Do not rely on the website as the insurance record. Done when Tonio and Mario both know where the current certificate lives.",
      },
      {
        key: "p0-waiver-review",
        text: "Save the reviewed waiver, terms, payment, and cancellation baseline",
        detail: "Mario task: keep proof that the website Terms, waiver, payment, and cancellation wording are the reviewed launch baseline. Do not improvise legal, waiver, cancellation, or payment wording in texts. Send Tonio any future required wording changes before using them with students.",
      },
      {
        key: "p0-payment-policy",
        text: "Follow the launch payment rules for every direct booking",
        detail: "Mario task: students pay through Cash App, Zelle, or PayPal and include the booking ID in the memo. Confirm any court reservation fee separately before the lesson. Mark a lesson paid in Admin only after the payment is actually received.",
      },
      {
        key: "p0-cancellation-policy",
        text: "Follow the launch cancellation rules",
        detail: "Mario task: 24+ hours notice means free cancellation or reschedule. Under 24 hours may be charged 50% of the lesson price. No-shows may be charged the full lesson price. If Mario cancels, offer a refund or free reschedule. Use Admin Cancel so the student receives the cancellation email.",
      },
      {
        key: "p0-venue",
        text: "Keep venue and platform permission proof on file",
        detail: "Mario task: save any venue or platform permission emails, owner texts, policy pages, or agreements. Public outdoor lessons can book through this site. Dallas Indoor and The Grove go through PodPlay, Life Time goes through Life Time, TeachMe.To stays on TeachMe.To, and Samuel-Grand court reservations go through Impact before the coaching fee is coordinated. Done when every student is routed through the correct path and the proof is easy to find.",
      },
      {
        key: "p0-soft-launch",
        text: "Start with a controlled soft launch for known students and referrals",
        detail: "Mario task: pick 5-10 trusted students or referrals to book through the site first. Personally text each one after they book. Use this to confirm the new venue-routing copy, calendar blocking, payment links, and admin handoff all feel clean.",
      },
      {
        key: "p0-taxes",
        text: "Set aside 25–30% of every payment for self-employment taxes",
        detail: "Mario task: move 25-30% of every lesson payment into a separate tax savings bucket the same day you get paid. Ask a CPA whether quarterly tax payments are needed.",
      },
      {
        key: "p0-accounting",
        text: "Set up a spreadsheet (or Wave, free) to log every dollar in and out",
        detail: "Mario task: keep one simple list of every lesson payment and every coaching expense. Update it weekly. Done when you can answer: 'How much did coaching make this month?'",
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
        detail: "Mario task: create or claim the profile, use the site URL, phone number, service area, lesson photos, and pickleball coaching category. Done when Google says the profile is verified and visible.",
      },
      {
        key: "p1-google-reviews",
        text: "Ask your first 10 students for a Google review (send them a direct link via text)",
        detail: "Mario task: after Google Business is verified, send 10 recent students the review link. Use one short text: 'Could you leave a quick review about our lesson? It helps people find me.' Done when at least 10 reviews are live.",
      },
      {
        key: "p1-instagram",
        text: "Professionalize Instagram, then post 3x/week — drills, tips, court moments",
        detail: "Mario task: update the Instagram handle, profile photo, bio, and booking-site link so it feels clearly pickleball/coaching related. Then post three simple clips each week: one drill, one student/court moment if allowed, and one quick tip. Send Tonio the final handle before the website social link changes.",
      },
      {
        key: "p1-tiktok",
        text: "Post to TikTok (@DemarioMontez) 3x/week — 'fix this mistake' style clips",
        detail: "Mario task: post three short clips each week using a clear hook like 'Stop missing this return' or 'One dink mistake I see every day.' Keep it useful, not polished.",
      },
      {
        key: "p1-dipc-listing",
        text: "Ask Dallas Indoor PBC to list you on their website as Head Pro",
        detail: "Mario task: ask the club contact to add your name, photo, coaching title, phone/email, and booking site link to their website or coach page. Done when the listing is live.",
      },
      {
        key: "p1-dupr-api-access",
        text: "Ask DUPR for read-only API or partner access for your coaching site",
        detail: "Mario task: log into DUPR, contact support/API or partner support, and ask for read-only access so demariomontezpb.com can display your verified singles and doubles ratings. Send Tonio the approval email, token instructions, or partner contact. Until DUPR approves access, Tonio updates ratings manually.",
      },
      {
        key: "p1-email-list",
        text: "Start an email list with Mailchimp (free up to 500 contacts)",
        detail: "Mario task: create a free Mailchimp account and start adding students who agree to get updates. Start with name and email only. Do not import people who did not give permission.",
      },
      {
        key: "p1-linktree",
        text: "Add a link-in-bio on Instagram and TikTok pointing to your booking site",
        detail: "Mario task: put demariomontezpb.com in the bio for Instagram, TikTok, and any Linktree/beacons page. Done when someone watching a video can tap once and reach booking.",
      },
    ],
  },
  {
    phase: "Phase 2",
    title: "Booking & Payments",
    timeframe: "Months 1–3",
    items: [
      {
        key: "p2-google-calendar-connect",
        text: "Connect your Google Calendar so the site blocks busy times",
        detail: "Mario task: sign into demariomontez10@gmail.com when Tonio sends the Google permission flow. Approve Calendar free/busy access only. Do not change Vercel or Google Cloud settings yourself. Done when Tonio confirms the admin Availability page says Google Calendar is connected.",
      },
      {
        key: "p2-site-time-slots",
        text: "Choose the lesson times students are allowed to book",
        detail: "Mario task: write the normal times you want students to see, like 9:00 AM, 10:30 AM, 5:00 PM. Add them in Admin -> Availability -> Time slots, or send the list to Tonio. Do not add times you are not willing to teach.",
      },
      {
        key: "p2-stripe",
        text: "Connect Stripe to this site to collect payment upfront at booking",
        detail: "Mario task: wait until the business bank account is ready, then create Stripe under the business name. Send Tonio access or connect it together. Do not connect Stripe to a personal bank account unless a CPA says that is the right plan.",
      },
      {
        key: "p2-email-confirm",
        text: "Send yourself one test booking and confirm the emails look right",
        detail: "Mario task: after Tonio says email is configured, make one test booking with your own email and phone. Confirm the student email, admin email, calendar attachment, payment links, court preference, location wording, and price all look right.",
      },
      {
        key: "p2-packages",
        text: "Create lesson packages (3-pack, 5-pack) at a small discount to lock in repeat students",
        detail: "Mario task: choose the package names, prices, and rules. Example: 3-pack, 5-pack, expiration date, refund policy. Send the exact package details to Tonio before adding them to the site.",
      },
      {
        key: "p2-cancel-policy",
        text: "Text every new student your 24-hour cancellation policy before their first session",
        detail: "Mario task: use one saved text for every new student: 'Quick reminder: 24-hour cancellation policy. Under 24 hours may be charged.' Keep the wording aligned with the reviewed launch policy.",
      },
      {
        key: "p2-weekly-admin-review",
        text: "Review bookings, inquiries, unpaid lessons, and blocked dates every week",
        detail: "Mario task: once a week, open Admin. Check Bookings, mark paid lessons, answer inquiries, block unavailable days, and clear completed Tasks. This is the basic weekly habit that keeps the site trustworthy.",
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
        detail: "Mario task: pick one repeatable clinic time, max players, price per player, and topic. Example: Saturdays 10:00 AM, 4 players, $50 each, beginner strategy. Send Tonio the details if it should appear on the site.",
      },
      {
        key: "p3-content-series",
        text: "Start a 'Fix Your Game' short-video series — one common mistake per week",
        detail: "Mario task: make one recurring weekly video format. Pick a common mistake, show the fix, and end with 'Book a lesson at demariomontezpb.com.' Save good clips for future ads.",
      },
      {
        key: "p3-free-consult",
        text: "Offer a free 15-minute intro call as a lead magnet for people on the fence",
        detail: "Mario task: decide whether you want to offer these. If yes, pick the call length, when calls can happen, and the script: goal, level, location, next lesson recommendation.",
      },
      {
        key: "p3-referral-promo",
        text: "Run a 'bring a friend' intro lesson promotion — fills your calendar fast",
        detail: "Mario task: choose the offer, like '$10 off if you bring a friend.' Text it to current students and track who referred whom in your notes or CRM.",
      },
      {
        key: "p3-gift-cards",
        text: "Offer lesson gift cards — sells well around holidays",
        detail: "Mario task: choose gift card amounts, expiration rules, and how buyers receive them. Start manually before building anything custom on the site.",
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
        detail: "Mario task: once a month, total lesson revenue, court fees, equipment, software, insurance, taxes saved, and net profit. Done when you know whether coaching actually made money that month.",
      },
      {
        key: "p4-quarterly-taxes",
        text: "Pay estimated quarterly taxes (due: Apr 15, Jun 16, Sep 15, Jan 15)",
        detail: "Mario task: ask a CPA whether you need quarterly payments. If yes, put the due dates on your calendar and pay from the tax savings bucket.",
      },
      {
        key: "p4-second-coach",
        text: "Find and vet a second coach to handle overflow group clinics",
        detail: "Mario task: list 2-3 coaches you trust, watch them teach, agree on pay split, and confirm insurance/waiver coverage before sending students to them.",
      },
      {
        key: "p4-curriculum",
        text: "Build a structured 4-week beginner curriculum with written drill progressions",
        detail: "Mario task: write four lesson themes in order: basics, serve/return, kitchen/dinks, point strategy. Add 2-3 drills per week and what students should practice at home.",
      },
      {
        key: "p4-testimonials",
        text: "Collect video testimonials from your 3 best students",
        detail: "Mario task: ask three happy students to record a 20-30 second clip. Ask what level they started at, what improved, and why they recommend you. Get clear permission before posting.",
      },
      {
        key: "p4-crm",
        text: "Start a simple student CRM — name, level, goals, last session notes (Notion or a spreadsheet)",
        detail: "Mario task: keep one row per student: name, phone/email, level, goals, last lesson date, next focus, and payment/package status. Update it after each lesson.",
      },
      {
        key: "p4-court-pipeline",
        text: "Build the court expansion pipeline before adding more venue choices",
        detail: "Mario task: before Tonio adds a new club, park, or platform to the site, capture the venue name, booking owner, payment owner, waiver/insurance owner, court fees, cancellation rules, required link, and whether direct site scheduling is allowed. This keeps booking simple as the court list grows.",
      },
      {
        key: "p4-solopreneur-support",
        text: "Review CPA, Collective, or S-corp support once revenue justifies it",
        detail: "Mario task: after coaching revenue is steady, ask a CPA whether an S-corp election or a solopreneur back-office service like Collective would save enough on taxes and admin work to be worth the cost.",
      },
      {
        key: "p4-ai-ops-assistant",
        text: "Pilot an AI-native ops assistant for reminders and back-office follow-up",
        detail: "Mario task: once weekly admin habits are stable, test a lightweight assistant that reminds you about unpaid lessons, follow-up texts, student notes, court-routing tasks, monthly P&L, taxes, and admin chores.",
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
        detail: "Mario task: only start this after in-person lessons are stable. Pick one narrow promise, like 'beginner doubles strategy,' outline 6-10 short lessons, and validate interest with current students first.",
      },
      {
        key: "p5-sponsorship",
        text: "Reach out to Selkirk, Franklin, or Joola for a gear/sponsorship deal",
        detail: "Mario task: make a one-page pitch with DUPR rating, tournament wins, student count, social links, and what you can offer. Send it to brand rep or ambassador programs.",
      },
      {
        key: "p5-tournament-pkg",
        text: "Offer a tournament coaching package — scout opponents, travel, courtside coaching",
        detail: "Mario task: define what is included, price, travel rules, and whether it covers one match, one day, or a full tournament. Test it with one serious student before promoting broadly.",
      },
      {
        key: "p5-coach-team",
        text: "Build a team of coaches under the DeMario Montez brand",
        detail: "Mario task: wait until your own booking, payment, insurance, and admin systems are stable. Then create coach standards, pay rules, insurance requirements, and a review process before adding anyone.",
      },
      {
        key: "p5-speaking",
        text: "Run a workshop at a local pickleball club or corporate wellness event",
        detail: "Mario task: create one workshop topic, a 45-60 minute format, and a simple flyer. Ask one club or company to host it, then send attendees to the booking site afterward.",
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
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  async function toggle(key: string) {
    if (pendingKeys.has(key)) return;
    setPendingKeys((prev) => new Set(prev).add(key));
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
      setPendingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
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
          Mario&apos;s plain-English operating checklist. Each item says what to do,
          what done looks like, and when to hand something back to Tonio.
        </p>
        <div className="overall-bar">
          <div className="overall-fill" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <QuickAddTask
        category="Business"
        hint="Need to add something for Mario or the team? Type it here and it will appear in the Tasks list."
      />

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
                const saving = pendingKeys.has(item.key);
                return (
                  <div
                    key={item.key}
                    role="checkbox"
                    aria-checked={done}
                    tabIndex={0}
                    className={`roadmap-item${done ? " done" : ""}${saving ? " saving" : ""}`}
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
