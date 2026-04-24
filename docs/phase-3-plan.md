# Site Improvement Plan — Phase 3 and beyond

**Date:** April 24, 2026
**Status:** Planned (Phases 1 and 2 shipped in branch `claude/site-improvements-review-xlvIk`)

This is the **technical** roadmap for the site. Live version (checkable by
Mario) is at `/admin/site-roadmap`. Business roadmap lives at
`/admin/roadmap` — don't mix them up.

## What's already shipped

### Phase 1 — Domain & payments (commit `06bd406`)
- Domain URL centralized in `src/lib/site.ts` (reads `NEXT_PUBLIC_SITE_URL`,
  defaults to `demariomontezpb.com`). All 7 hardcoded references removed.
- `PaymentOptions` component on booking confirmation + standalone `/pay` page
  linked from footer. Cash App, Zelle, PayPal QR. Shows booking ID so students
  tag payments with a matchable memo.
- Admin "Mark paid" toggle on the bookings table. `paid_at` timestamp column.

### Phase 2 — Email, MFA, availability (commit `808b031`)
- **Email:** Resend-based. `src/lib/email/{client,ics,templates}.ts`. Student
  gets a confirmation email with a `METHOD:REQUEST` `.ics` attachment
  (America/Chicago VTIMEZONE). Coach gets a notification email. Cancel sends
  `METHOD:CANCEL`.
- **MFA:** TOTP via Supabase's built-in MFA API. `/admin/mfa-setup` enrolls a
  factor, renders QR with `qrcode` npm package. Login has a 2-step flow.
  Protected layout requires `aal2`.
- **Availability:** DB-driven. New `time_slots` + `recurring_blocks` tables,
  `all_day` flag on `blocked_slots`. Admin availability tab redesigned into 3
  sections. Booking modal fetches times from API.

## Phase 3 — Enhancements

### 3A. Stripe Checkout at booking (high impact)

**Problem.** Right now booking is trust-based. Student books → gets email →
is expected to Cash App / Zelle / PayPal. There's nothing stopping them from
skipping the payment and showing up (or not showing up). No-shows cost Mario
real hours.

**Approach.** Stripe Checkout session created on booking POST. Student is
redirected to Stripe, pays, then Stripe redirects back to a success page.
Booking stays `status = pending` until Stripe's `checkout.session.completed`
webhook flips it to `confirmed` + sets `paid_at`.

**Files to touch:**
- `src/app/api/bookings/route.ts` — on successful insert, create a Checkout
  session, return the URL instead of just the booking ID.
- `src/app/api/webhooks/stripe/route.ts` (new) — verify signature, update
  booking on `checkout.session.completed`.
- `src/components/BookingModal.tsx` — redirect to the Checkout URL instead
  of going to the confirmed step.
- `src/app/booking/[id]/page.tsx` (new) — success landing page.

**New deps:** `stripe`, `@stripe/stripe-js` (optional, only if we render
Elements; we're using hosted Checkout so not strictly needed).

**Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

**Tradeoffs.** Fees are ~2.9% + $0.30 per transaction. On $70 that's $2.33.
Worth it vs. one no-show. Could keep the Cash App / Zelle / PayPal links on
`/pay` as fallback for follow-up payments.

### 3B. 24-hour lesson reminder email

**Problem.** Students forget lessons they booked 3 weeks ago.

**Approach.** Vercel Cron (free, daily). Query bookings where
`lesson_date = tomorrow AND status = confirmed AND reminder_sent_at IS NULL`.
Send reminder email. Set `reminder_sent_at`.

**Files:**
- `src/app/api/cron/reminders/route.ts` (new). Guarded by Vercel Cron auth
  header.
- `vercel.json` — add `crons` config, daily at 9am CT.
- `src/lib/email/templates.ts` — add `lessonReminderHtml()`.
- DB: `alter table bookings add column reminder_sent_at timestamptz`.

**Tradeoffs.** Vercel Cron runs on UTC; we'd run at 15:00 UTC (9am CT most
of the year — DST drift of 1 hour is fine for a reminder).

### 3C. Student self-reschedule link

**Problem.** Mario gets texts like "hey can we move Tuesday to Thursday?"
and has to manually update the booking.

**Approach.** Signed one-time link in every confirmation email. Student
clicks → sees their booking + a time picker limited to open slots →
submits → new `.ics` sent, old `.ics` cancelled.

**Files:**
- `src/app/reschedule/[token]/page.tsx` (new). Token = signed JWT of booking
  id, expires 48h before the lesson.
- `src/app/api/reschedule/[token]/route.ts` (new). PATCH updates the booking,
  fires both cancellation + new invite emails.
- `src/lib/email/templates.ts` — add reschedule link to the confirmation
  template.

**Deps:** `jose` for JWT signing (small, native).

### 3D. Rate limit the booking API

**Problem.** `POST /api/bookings` is unauthenticated. A bot could POST 100k
fake bookings, blocking every real student. Low likelihood, but the mitigation
is cheap.

**Approach.** Per-IP sliding window. Upstash Redis (free) or Vercel KV.
Limit: 5 booking attempts / IP / hour. Also adds a basic honeypot field to
the form (bots fill it, humans don't).

**Files:**
- `src/lib/rate-limit.ts` (new).
- `src/app/api/bookings/route.ts` — call at top of POST.
- `src/components/BookingModal.tsx` — add hidden honeypot input.

**Env:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

### 3E. Error monitoring (Sentry)

**Problem.** We find out the site is broken when a student tells Mario.

**Approach.** Sentry Next.js SDK. Free tier is fine for this volume.
Auto-captures unhandled errors server + client.

**Files:**
- Run `npx @sentry/wizard@latest -i nextjs` — scaffolds config files.
- Tag errors by route for easier triage.

**Env:** `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (for source map upload).

### 3F. Automated tests

**Problem.** Every change we ship is a coin flip. The April audit caught a
critical booking bug only because someone manually tested it.

**Approach.** Two layers:
1. **API tests (Vitest).** Call route handlers directly with mocked Supabase.
   Covers: booking validation, availability merging, time-slot CRUD,
   permissions.
2. **Playwright smoke test.** Full booking flow end-to-end against a local
   dev server with a test Supabase project. One test: open modal, fill
   form, pick time, submit, see confirmation. Runs on PR via GitHub Actions.

**New deps:** `vitest`, `@playwright/test`.

**Files:**
- `src/**/__tests__/*.test.ts` — colocated API tests.
- `e2e/booking.spec.ts` — Playwright smoke test.
- `.github/workflows/ci.yml` — run tests on PR.

## Phase 4 — Nice-to-haves (not scheduled)

- **Lesson packages** (3-pack / 5-pack) — needs Stripe (3A) first.
- **GA4 + Meta Pixel** — from the April audit, still open.
- **Waitlist** for fully-booked days with auto-notify on cancellations.
- **Private per-student notes** on the admin dashboard — lightweight CRM.

## Priority ordering (my take)

1. **3A Stripe** — biggest business impact, unblocks packages.
2. **3B reminders** — cheap, high perceived professionalism.
3. **3E Sentry** — you want this in place before 3A so you catch payment
   bugs immediately.
4. **3D rate limiting** — do it while you're already in the bookings API for 3A.
5. **3C reschedule** — nice quality-of-life, needs 3A first anyway.
6. **3F tests** — ideally woven in throughout, not a standalone phase.
