# Developer Implementation Plan

This is Tonio's code execution tracker. DeMario's operational business roadmap
should stay in `/admin/roadmap`.

## P0

- Repair linting and add CI.
- Add Vitest coverage for availability, booking validation, tasks, and email/ICS.
- Harden public booking and inquiry routes behind server-side validation.
- Centralize availability rules and reuse them across booking and availability APIs.
- Add booking modal focus management, dialog semantics, and mobile date strip polish.
- Run Supabase P0 migration for waiver columns and public PII policy cleanup.

## P1

- Add destructive-action confirmations in admin.
- Verify the production `bookings_unique_active_slot` database index exists.
- Expand Playwright smoke tests and run them in CI after browser install is configured.
- Refresh old audit/setup docs so stale findings are marked historical.
- Add rate limiting and honeypot fields to public POST endpoints.
- Add a short admin handoff guide for DeMario's weekly booking/inquiry/payment workflow.

## P2

- Add Sentry.
- Track dependency advisories for Next/PostCSS and Resend/Svix without using unsafe forced upgrades.
- Add privacy-conscious analytics after consent policy is final.
- Add reminders and reschedule links.
- Add Stripe Checkout only after the pickleball business entity and banking setup exist.

## Long-Term Reference

- Keep the Business roadmap focused on DeMario's operating tasks: venue approval, insurance, legal review, payments, follow-ups, and growth.
- Keep the Developer roadmap focused on Tonio's code/ops tasks: CI, tests, rate limiting, monitoring, database constraints, dependency upgrades, and stale documentation.
- Before broader promotion or paid ads, complete abuse protection, production monitoring, and live admin workflow documentation.
