# Developer Implementation Plan

This is Tonio's code execution tracker. DeMario's operational business roadmap
should stay in `/admin/roadmap`.

## Current Status

- P0 reliability work is shipped.
- P1 launch-confidence work is shipped in code and CI.
- The repo is ready for controlled client use after the manual Supabase and live-release checks in `docs/RELEASE_CHECKLIST.md`.
- Broader promotion still depends on business gates: venue approval, insurance, waiver/terms review, and final payment/cancellation policy.

## Shipped

### P0

- Repaired linting and added CI.
- Added Vitest coverage for availability, booking validation, tasks, and email/ICS.
- Hardened public booking and inquiry routes behind server-side validation.
- Centralized availability rules and reused them across booking and availability APIs.
- Added booking modal focus management, dialog semantics, and mobile date strip polish.
- Added Supabase P0 migration for waiver columns and public PII policy cleanup.

### P1

- Added destructive-action confirmations in admin.
- Added Supabase P1 hardening SQL for `bookings_unique_active_slot` and `rate_limit_events`.
- Expanded Playwright smoke tests for homepage, booking, payment options, contact form, and admin gating.
- Added Playwright browser install and `npm run test:e2e` to GitHub Actions.
- Marked old audit docs as historical and refreshed setup/release docs.
- Added Supabase-backed rate limiting and honeypot fields to public POST endpoints.
- Added DeMario admin handoff docs.
- Added dependency advisory tracking docs.

## Remaining Manual Launch Gates

- Run `docs/supabase-p0-migration.sql` if it has not already been applied in production.
- Run `docs/supabase-p1-hardening.sql` in the Supabase SQL Editor.
- Verify `bookings_unique_active_slot` exists in production Supabase.
- Verify anon users cannot read or write `bookings`, `inquiries`, or `rate_limit_events`.
- Run the live manual checks in `docs/RELEASE_CHECKLIST.md`.
- Review `docs/ADMIN_HANDOFF.md` with DeMario.

## Deferred P2

- Add Sentry or equivalent production error monitoring.
- Add privacy-conscious analytics after consent/cookie policy is final.
- Add 24-hour reminder emails and student reschedule links.
- Add Stripe Checkout only after the pickleball business entity and banking setup exist.
- Upgrade dependency advisories when compatible patched versions are available; do not use `npm audit fix --force` without a tested migration branch.

## Long-Term Reference

- Keep the Business roadmap focused on DeMario's operating tasks: venue approval, insurance, legal review, payments, follow-ups, and growth.
- Keep the Developer roadmap focused on Tonio's code/ops tasks: CI, tests, monitoring, database constraints, dependency upgrades, and stale documentation.
- Before broader promotion or paid ads, complete the manual launch gates, production monitoring, and business gates.
