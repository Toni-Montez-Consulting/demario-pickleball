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
- Expand Playwright smoke tests and run them in CI after browser install is configured.
- Refresh old audit/setup docs so stale findings are marked historical.
- Add rate limiting and honeypot fields to public POST endpoints.

## P2

- Add Sentry.
- Add privacy-conscious analytics after consent policy is final.
- Add reminders and reschedule links.
- Add Stripe Checkout only after the pickleball business entity and banking setup exist.
