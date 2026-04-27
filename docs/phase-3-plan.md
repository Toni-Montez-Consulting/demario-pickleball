# Site Improvement Plan - Phase 3 and Beyond

**Date:** April 24, 2026
**Updated:** April 25, 2026
**Status:** Historical planning note. Use `docs/DEVELOPER_PLAN.md`, `docs/RELEASE_CHECKLIST.md`, and `/admin/site-roadmap` as the current execution sources.

This is the technical roadmap for the site. DeMario's operational business
roadmap lives at `/admin/roadmap`; the developer roadmap lives at
`/admin/site-roadmap`.

## Already Shipped

### Phase 1 - Domain & Payments

- Domain URL centralized in `src/lib/site.ts`.
- `PaymentOptions` component on booking confirmation and standalone `/pay`.
- Cash App, Zelle, and PayPal QR/payment options.
- Admin "Mark paid" toggle on bookings.

### Phase 2 - Email, MFA, Availability

- Resend confirmation, notification, and cancellation emails.
- ICS calendar attachments for booking and cancellation messages.
- TOTP MFA for admin access through Supabase.
- DB-driven time slots, blocked slots, and recurring availability.

### Launch-Hardening Wave

- Vitest unit/API tests for availability, booking validation, inquiries, tasks, email, ICS, and rate limiting.
- Playwright smoke tests for homepage, booking modal, payment options, contact form, and admin gating.
- GitHub Actions now runs typecheck, lint, tests, build, Playwright browser install, and e2e smoke tests.
- Public booking and inquiry POST routes use server-side validation, honeypot fields, and Supabase-backed hashed-IP rate limiting.
- `docs/supabase-p1-hardening.sql` creates/verifies the active-booking unique index and rate-limit table.
- Admin destructive actions now require confirmation and show API error messages where available.
- Admin handoff and dependency advisory docs were added.
- Google Calendar FreeBusy blocking was added to availability and booking APIs, with admin diagnostics in Availability.
- Mario-facing tasks and the owner action plan were clarified in `/admin/tasks`, `/admin/roadmap`, and `docs/MARIO_ACTION_PLAN.md`.

## Remaining Manual Launch Work

- Run `docs/supabase-p1-hardening.sql` in Supabase before treating rate limiting as active in production.
- Verify production RLS and index state from `docs/RELEASE_CHECKLIST.md`.
- Generate a fresh production Google refresh token with DeMario and confirm a busy Google Calendar event blocks a public lesson slot.
- Complete live manual checks: inquiry, booking, emails, cancellation, payment links, QR rendering, MFA, and DeMario handoff.
- Confirm business gates before broad promotion: venue permission, insurance, legal review, and final payment/cancellation policy.
- Have Mario complete the short-term Admin Tasks list: Google Calendar connection, DUPR access request, bookable lesson times, venue permission, insurance/waiver review, and Google Business verification.

## Deferred Technical Work

### Stripe Checkout

Deferred until the pickleball business entity, banking, and Stripe account setup are ready.

Future implementation shape:
- `src/app/api/bookings/route.ts` creates a Stripe Checkout session after a booking is validated.
- `src/app/api/webhooks/stripe/route.ts` verifies webhooks and marks bookings paid/confirmed.
- `src/components/BookingModal.tsx` redirects to hosted Checkout.
- Keep `/pay` as a fallback for manual payment links.

### 24-Hour Reminder Email

Deferred until after the controlled launch.

Future implementation shape:
- Vercel Cron route guarded by cron auth.
- Query confirmed bookings for tomorrow where `reminder_sent_at is null`.
- Send reminder email and persist `reminder_sent_at`.

### Student Self-Reschedule Link

Deferred until after the core booking workflow has real usage.

Future implementation shape:
- Signed expiring token in the confirmation email.
- Student page with available dates/times.
- API route updates the booking and sends cancellation/new invite emails.

### Production Error Monitoring

Deferred but recommended before broader promotion.

Future implementation shape:
- Add Sentry or equivalent.
- Capture server/client errors.
- Tag errors by route and environment.

### Analytics

Deferred until consent/cookie policy is settled.

Future implementation shape:
- Privacy-conscious analytics only.
- Track booking modal opens, booking successes, inquiry submissions, and payment page views.

### DUPR Rating Sync

Deferred until Mario receives official read-only API token instructions or partner access from DUPR.

Future implementation shape:
- Store DUPR credentials in Vercel only.
- Add a server-side sync or cached fetch for verified singles/doubles ratings.
- Keep the current manual ratings as fallback if DUPR access is unavailable.

## Not Scheduled

- Lesson packages, because they depend on Stripe/payment operations.
- Waitlist for fully booked days.
- Private student CRM notes.
- Gift cards or memberships.

## Current Priority Order

1. Complete Supabase/live manual release checks.
2. Help Mario finish the short-term Admin Tasks list.
3. Confirm Google Calendar blocking with a real busy event.
4. Use the site with controlled referrals and known students.
5. Resolve business gates for broader promotion.
6. Add production monitoring.
7. Revisit reminders/rescheduling after real booking volume appears.
8. Revisit Stripe after business entity and banking setup are ready.
