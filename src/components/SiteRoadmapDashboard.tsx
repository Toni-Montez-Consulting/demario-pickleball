"use client";

import { useRef, useState } from "react";

interface DevRoadmapItem {
  key: string;
  text: string;
  detail?: string;
  shipped?: boolean;
}

interface DevRoadmapPhase {
  phase: string;
  title: string;
  timeframe: string;
  items: DevRoadmapItem[];
}

const PHASES: DevRoadmapPhase[] = [
  {
    phase: "P0",
    title: "Reliability Foundation",
    timeframe: "Current implementation wave",
    items: [
      {
        key: "dev-p0-lint-ci",
        text: "Repair linting, add typecheck/test scripts, and run them in GitHub Actions",
        detail: "CI should validate install, typecheck, lint, unit/API tests, and production build without production secrets.",
        shipped: true,
      },
      {
        key: "dev-p0-booking-integrity",
        text: "Centralize booking availability rules and enforce them in the API",
        detail: "The booking POST and availability GET should share the same slot, booking, one-off block, and recurring block logic.",
        shipped: true,
      },
      {
        key: "dev-p0-public-data",
        text: "Harden public data access and keep PII behind server-side routes",
        detail: "Public users should not be able to read bookings or inquiries through Supabase anon access.",
        shipped: true,
      },
      {
        key: "dev-p0-booking-a11y",
        text: "Polish the booking modal on mobile and for keyboard/screen reader users",
        detail: "Dialog semantics, focus management, Escape close, horizontal date strip, and clear empty/error states.",
        shipped: true,
      },
      {
        key: "dev-p0-tests",
        text: "Add a practical test suite around booking, availability, email/ICS, and core UI states",
        detail: "Vitest for utilities/API behavior; Playwright smoke tests for browser confidence.",
        shipped: true,
      },
    ],
  },
  {
    phase: "P1",
    title: "Launch Confidence",
    timeframe: "After P0 is green",
    items: [
      {
        key: "dev-p1-admin-polish",
        text: "Improve admin error states, destructive-action confirmations, and mobile usability",
        detail: "Failed data loads should not look like empty data. Delete/cancel actions should be deliberate.",
        shipped: true,
      },
      {
        key: "dev-p1-docs",
        text: "Refresh setup, release, rollback, and Supabase policy docs",
        detail: "Old audit docs should be clearly marked historical or replaced with current operational docs.",
        shipped: true,
      },
      {
        key: "dev-p1-db-constraints",
        text: "Run and verify Supabase P1 hardening SQL in production",
        detail: "The migration exists in docs/supabase-p1-hardening.sql; run it in Supabase and verify the unique index, rate-limit table, and RLS state.",
      },
      {
        key: "dev-p1-location-clarity",
        text: "Ship Location Clarity Booking V1 before public launch",
        detail: "Phone and court setup are required, outdoor courts are grouped, and Mario gets the student handoff details in admin/email.",
        shipped: true,
      },
      {
        key: "dev-p1-e2e",
        text: "Expand Playwright coverage for homepage, booking, payment options, contact, and admin gating",
        detail: "Use mocked API responses by default so CI does not need production credentials.",
        shipped: true,
      },
      {
        key: "dev-p1-rate-limit",
        text: "Add lightweight abuse protection to public booking and inquiry endpoints",
        detail: "Rate limiting and honeypot fields reduce fake booking and spam risk.",
        shipped: true,
      },
      {
        key: "dev-p1-google-calendar",
        text: "Add Google Calendar FreeBusy blocking and admin diagnostics",
        detail: "Availability and booking POST both check DeMario's Google busy ranges. Admin Availability shows whether the sync is connected after Mario authorizes Google.",
        shipped: true,
      },
    ],
  },
  {
    phase: "P2",
    title: "Operations & Growth",
    timeframe: "Later",
    items: [
      {
        key: "dev-p2-sentry",
        text: "Add production error monitoring",
        detail: "Sentry SDK is wired for server/client errors. Production DSN setup and a verified test event are post-launch ops work unless Tonio and Mario decide to make monitoring mandatory.",
        shipped: true,
      },
      {
        key: "dev-p2-dependency-watch",
        text: "Track dependency advisories without forcing unsafe upgrades",
        detail: "docs/DEPENDENCY_ADVISORIES.md tracks current advisories and the GitHub Actions Node transition.",
        shipped: true,
      },
      {
        key: "dev-p2-github-actions-node24",
        text: "Move GitHub Actions to the Node 24 runner default",
        detail: "GitHub is moving JavaScript actions from Node 20 to Node 24 defaults in 2026. Update/verify checkout and setup-node before the runner cutoff, then run the full CI and e2e suite.",
      },
      {
        key: "dev-p2-analytics",
        text: "Add privacy-conscious analytics and conversion events",
        detail: "Only after consent/cookie policy is settled. Track booking modal opens and successful booking requests.",
      },
      {
        key: "dev-p2-reminders",
        text: "Add 24-hour lesson reminder emails",
        detail: "Scheduled job plus reminder_sent_at tracking after the core booking system is stable.",
      },
      {
        key: "dev-p2-student-cancel-reschedule",
        text: "Add secure student cancellation and reschedule links",
        detail: "Send private token links in confirmation/reminder emails so students can cancel or request a reschedule without calling Mario. Enforce the 24-hour policy in the UI/API, keep admin cancellation as the fallback, notify Mario and the student, send ICS cancel/update files, and leave refunds/payment adjustments manual until Stripe exists.",
      },
      {
        key: "dev-p2-stripe",
        text: "Add Stripe Checkout after the pickleball business entity is ready",
        detail: "Backburner until business banking/entity setup exists. Keep manual Cash App/Zelle/PayPal flow for now.",
      },
      {
        key: "dev-p2-dupr-sync",
        text: "Add automated DUPR rating sync after Mario gets official access",
        detail: "Wait for Mario to receive DUPR read-only token instructions or partner approval, then add a server-side sync for verified singles/doubles ratings.",
      },
    ],
  },
];

const CHECKABLE_ITEMS = PHASES.flatMap((p) => p.items).filter((i) => !i.shipped);

export default function SiteRoadmapDashboard({ initialChecked }: { initialChecked: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
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

  const totalCheckable = CHECKABLE_ITEMS.length;
  const totalDone = CHECKABLE_ITEMS.filter((i) => checked.has(i.key)).length;
  const overallPct = totalCheckable > 0 ? (totalDone / totalCheckable) * 100 : 0;

  return (
    <div className="admin-wrap roadmap-wrap">
      <div className="roadmap-header">
        <div className="admin-header">
          <h1>Developer Roadmap</h1>
          <span className="admin-count">{totalDone} / {totalCheckable} complete</span>
        </div>
        <p className="roadmap-sub">
          Implementation tracker for Tonio. Mario&apos;s nontechnical operating tasks
          live under Tasks and Business.
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
