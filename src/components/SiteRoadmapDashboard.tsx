"use client";

import { useState } from "react";

interface SiteRoadmapItem {
  key: string;
  text: string;
  detail?: string;
  shipped?: boolean;
}

interface SiteRoadmapPhase {
  phase: string;
  title: string;
  timeframe: string;
  items: SiteRoadmapItem[];
}

const PHASES: SiteRoadmapPhase[] = [
  {
    phase: "Phase 1",
    title: "Domain & Payments",
    timeframe: "Shipped",
    items: [
      {
        key: "site-p1-domain-code",
        text: "Code centralizes site URL (SITE_URL env var) so domain swaps are one-line",
        detail: "Codebase no longer has demario-pickleball.vercel.app hardcoded. Metadata, sitemap, robots, JSON-LD all read from src/lib/site.ts.",
        shipped: true,
      },
      {
        key: "site-p1-payments-code",
        text: "PaymentOptions component on booking confirmation + /pay page + footer link",
        detail: "Cash App, Zelle, and PayPal QR. Shows booking ID reminder so students tag payments with a memo you can match.",
        shipped: true,
      },
      {
        key: "site-p1-paid-toggle",
        text: "Admin 'Mark paid' toggle on bookings table",
        detail: "Since Cash App / Zelle / PayPal personal have no webhook, you mark bookings paid manually when money arrives.",
        shipped: true,
      },
      {
        key: "site-p1-domain-buy",
        text: "Buy demariomontezpb.com and add it to your Vercel project",
        detail: "Namecheap / GoDaddy / Cloudflare all work. Vercel will give you DNS records to paste into the registrar.",
      },
      {
        key: "site-p1-sql-paid",
        text: "Run SQL in Supabase: alter table bookings add column paid_at timestamptz",
        detail: "One-liner in Supabase SQL editor. The 'Mark paid' toggle won't work until this column exists.",
      },
      {
        key: "site-p1-paypal-qr",
        text: "Drop the real PayPal QR image at public/img/paypal-qr.png",
        detail: "Screenshot the QR from your PayPal app, save as PNG, upload to the repo at that path. Until then the PayPal slot shows a broken image (Cash App + Zelle still work).",
      },
    ],
  },
  {
    phase: "Phase 2",
    title: "Email, MFA, Availability Editor",
    timeframe: "Shipped",
    items: [
      {
        key: "site-p2-email-code",
        text: "Booking confirmation emails with .ics calendar invites (via Resend)",
        detail: "Student gets a 'you're booked' email with a calendar invite that adds the lesson to their calendar in one tap. You get a separate 'new booking' notification. Cancelling a booking sends a cancellation .ics that removes it from their calendar.",
        shipped: true,
      },
      {
        key: "site-p2-mfa-code",
        text: "TOTP multi-factor authentication on admin login",
        detail: "Password + 6-digit code from Google Authenticator / 1Password / Authy. Anyone with just your password can't log in.",
        shipped: true,
      },
      {
        key: "site-p2-avail-code",
        text: "DB-backed availability editor (time slots, recurring blocks, whole-day blocks)",
        detail: "Three sections in admin: edit time slots, set recurring unavailability (e.g. every Tuesday), and block specific dates (single slot or whole day).",
        shipped: true,
      },
      {
        key: "site-p2-sql-migrate",
        text: "Run Phase 2 SQL migrations in Supabase",
        detail: "Creates time_slots + recurring_blocks tables and adds all_day to blocked_slots. Full SQL is in the Phase 2 commit message (808b031). Booking and admin will both break until this is run.",
      },
      {
        key: "site-p2-resend",
        text: "Sign up for Resend, add RESEND_API_KEY + EMAIL_FROM + ADMIN_EMAIL to Vercel",
        detail: "Resend has a free tier (3k emails/mo). Until your sending domain is verified in Resend, use their shared sender 'onboarding@resend.dev'. Emails just won't send until this is set — bookings still work.",
      },
      {
        key: "site-p2-mfa-enroll",
        text: "Enroll your authenticator app at /admin/mfa-setup on first login",
        detail: "After deploying Phase 2, your first admin login will redirect you here. Scan the QR with Google Authenticator / 1Password / Authy. Save the recovery secret somewhere safe in case you lose your phone.",
      },
    ],
  },
  {
    phase: "Phase 3",
    title: "Post-launch Enhancements",
    timeframe: "Next",
    items: [
      {
        key: "site-p3-stripe",
        text: "Stripe Checkout at booking (replaces the trust-based payment model)",
        detail: "Charge upfront at the time of booking. Eliminates no-shows — anyone who paid is showing up. Also removes the 'include booking ID in memo' friction. Roughly 2.9% + $0.30 per transaction.",
      },
      {
        key: "site-p3-reminders",
        text: "Automated 24-hour lesson reminder email",
        detail: "Scheduled job that scans upcoming bookings and emails a reminder the day before. Reduces no-shows and signals professionalism. Runs on Vercel Cron (free).",
      },
      {
        key: "site-p3-reschedule",
        text: "Self-serve student reschedule link in confirmation emails",
        detail: "One less inbound text for you. Student clicks a signed link in their confirmation email, picks a new open slot, done. The system sends a new .ics invite + cancellation for the old slot.",
      },
      {
        key: "site-p3-rate-limit",
        text: "Rate-limit the booking API to prevent spam bookings",
        detail: "Right now anyone can POST to /api/bookings without auth. A bot could flood your schedule with fake bookings and block real students. Fix: per-IP rate limit on the endpoint (e.g. 5 bookings / hour / IP).",
      },
      {
        key: "site-p3-monitoring",
        text: "Error alerts when the site errors in production",
        detail: "Sentry (free tier) or similar. You find out about broken pages before your students do. One-liner install in the Next app.",
      },
      {
        key: "site-p3-tests",
        text: "Automated tests so future changes can't silently break booking",
        detail: "API-level tests on /api/bookings, /api/availability, /api/time-slots. Catches regressions before deploy. Playwright for a smoke test on the full booking flow.",
      },
    ],
  },
  {
    phase: "Phase 4",
    title: "Nice-to-haves",
    timeframe: "Later",
    items: [
      {
        key: "site-p4-packages",
        text: "Lesson packages (3-pack / 5-pack) at a small discount",
        detail: "Locks in repeat students. One click from the lesson-type dropdown. Needs Stripe (Phase 3) to collect the full amount upfront.",
      },
      {
        key: "site-p4-analytics",
        text: "Add GA4 + Meta Pixel for traffic / conversion tracking",
        detail: "From the April audit — still open. Can't measure marketing ROI without it.",
      },
      {
        key: "site-p4-waitlist",
        text: "Waitlist for fully-booked days",
        detail: "If a slot becomes free (someone cancels), auto-notify the waitlist. Recovers revenue from cancellations.",
      },
      {
        key: "site-p4-student-notes",
        text: "Private per-student notes on the admin dashboard",
        detail: "Lightweight CRM — next to each booking, show past lessons + goals + notes from last session. Compounds your coaching quality.",
      },
    ],
  },
];

const CHECKABLE_ITEMS = PHASES.flatMap((p) => p.items).filter((i) => !i.shipped);

export default function SiteRoadmapDashboard({ initialChecked }: { initialChecked: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));

  async function toggle(key: string) {
    const next = !checked.has(key);
    setChecked((prev) => {
      const s = new Set(prev);
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });
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
  }

  const totalCheckable = CHECKABLE_ITEMS.length;
  const totalDone = CHECKABLE_ITEMS.filter((i) => checked.has(i.key)).length;
  const overallPct = totalCheckable > 0 ? (totalDone / totalCheckable) * 100 : 0;

  return (
    <div className="admin-wrap roadmap-wrap">
      <div className="roadmap-header">
        <div className="admin-header">
          <h1>Site Roadmap</h1>
          <span className="admin-count">{totalDone} / {totalCheckable} open items done</span>
        </div>
        <p className="roadmap-sub">
          Tracks what&apos;s shipped in code, what you need to do manually, and what&apos;s planned next.
          Separate from the business roadmap.
        </p>
        <div className="overall-bar">
          <div className="overall-fill" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {PHASES.map((phase) => {
        const shippedCount = phase.items.filter((i) => i.shipped).length;
        const checkable = phase.items.filter((i) => !i.shipped);
        const done = shippedCount + checkable.filter((i) => checked.has(i.key)).length;
        const pct = phase.items.length > 0 ? (done / phase.items.length) * 100 : 0;
        return (
          <div key={phase.phase} className="roadmap-phase">
            <div className="phase-header">
              <div className="phase-meta">
                <span className="phase-badge">{phase.phase}</span>
                <span className="phase-timeframe">{phase.timeframe}</span>
              </div>
              <div className="phase-title-row">
                <h2 className="phase-title">{phase.title}</h2>
                <span className="phase-count">{done}/{phase.items.length}</span>
              </div>
              <div className="phase-bar">
                <div className="phase-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="roadmap-items" role="group">
              {phase.items.map((item) => {
                const isShipped = !!item.shipped;
                const isChecked = isShipped || checked.has(item.key);
                const interactive = !isShipped;
                return (
                  <div
                    key={item.key}
                    role={interactive ? "checkbox" : undefined}
                    aria-checked={interactive ? (isChecked ? "true" : "false") : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-disabled={isShipped ? "true" : undefined}
                    className={`roadmap-item${isChecked ? " done" : ""}${isShipped ? " shipped" : ""}`}
                    onClick={interactive ? () => toggle(item.key) : undefined}
                    onKeyDown={(e) => {
                      if (!interactive) return;
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
                      <div className="item-text">
                        {item.text}
                        {isShipped && <span className="shipped-badge">shipped</span>}
                      </div>
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
