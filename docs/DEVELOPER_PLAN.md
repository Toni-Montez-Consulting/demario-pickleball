# Developer Implementation Plan

This is Tonio's code execution tracker. DeMario's operational business roadmap
should stay in `/admin/roadmap`.

## Current Status

- P0 reliability work is shipped.
- P1 launch-confidence work is shipped in code and CI.
- Location Clarity Booking V1 is shipped in code: phone is required, court preference is collected, and Mario gets the handoff details.
- Sentry monitoring is wired in code; production DSN/env setup and a verified test event are tracked as post-launch ops unless Tonio and Mario decide to make monitoring mandatory.
- Outstanding business and operational launch gates are tracked in `docs/LAUNCH_OUTSTANDING.md`.
- The repo is ready for controlled client use after the manual Supabase and live-release checks in `docs/RELEASE_CHECKLIST.md`.
- Broader promotion now depends on final live checks and following the venue-routing matrix; legal, insurance, waiver, cancellation, and payment policy work is treated as sorted for launch with proof kept outside the repo.

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
- Added Google Calendar FreeBusy blocking and admin Availability diagnostics.
- Added Location Clarity Booking V1: Where We Train homepage section, required phone, required court setup preference, court preference stored in booking notes, and clearer court/payment copy.
- Hardened admin API routes so allowed admin emails also need Supabase `aal2` MFA.
- Added Sentry server/client instrumentation and an admin-only monitoring verification endpoint.
- Added guided indoor routing: public courts stay direct-bookable through the site, while indoor/platform-required paths route to PodPlay, Life Time, TeachMe.To, or Impact/Samuel-Grand instructions before showing site times.
- Hardened the booking API so direct POSTs cannot bypass indoor/platform-required routing.
- Deferred availability/Google Calendar checks until students continue to site-bookable times.
- Added first-week admin booking filters plus one-tap text/call actions from booking rows.

### Student Spine and Review Loop (2026-07-25)

Shipped in code and CI. Not yet live: the migration and backfill are manual gates below.

- Added `students` as the person object bookings and reviews hang off, canonical by normalized
  phone then email. A phone match with a conflicting name or email raises `needs_review`
  instead of silently merging or duplicating.
- Linked booking creation to student records and added a `no_show` booking status.
- Added a one-time backfill script with a reconciliation report that exits non-zero if the
  counts do not balance.
- Added the review loop: tokenized post-lesson links, a public `/review` link for past clients,
  an admin moderation queue, and homepage rendering of published reviews only.
- Moderation is publish / hide / delete plus Mario's own tag and takeaway labels. There is no
  code path that edits a student's words.
- Retired the seven hardcoded testimonials in favour of database rows seeded as `legacy`.
- Added a daily Vercel cron that emails review requests 24h after each confirmed lesson,
  idempotent via `bookings.review_request_sent_at`.
- Added the Film Room section for self-hosted coaching clips. Hidden until clips are added.
- Fixed a pre-existing class of bug found while building this: form controls driven purely by
  React state dropped any tap landing before hydration. The review rating is a native radio
  group with a CSS-only fill.

## Remaining Manual Launch Gates

- Run `docs/supabase-p0-migration.sql` if it has not already been applied in production.
- Run `docs/supabase-p1-hardening.sql` in the Supabase SQL Editor.
- Run `docs/supabase-priority-migration.sql` in the Supabase SQL Editor if task priority support is not already present.
- Run the pre-flight status query in `docs/supabase-students-reviews-migration.sql`, then run the migration.
- Decide whether the four `REVIEW_WALL` legacy testimonials are permissioned before running the seed. Cut that insert if not.
- Run `node scripts/backfill-students.mjs` once with production credentials and confirm the reconciliation balances.
- Set `CRON_SECRET` in Vercel and redeploy, then confirm the cron appears in the project's Cron Jobs tab.
- Submit one real review end to end and publish it from Admin -> Reviews.
- Verify `bookings_unique_active_slot` exists in production Supabase.
- Verify `admin_tasks.priority` exists and accepts `high` / `normal`.
- Verify anon users cannot read or write `bookings`, `inquiries`, or `rate_limit_events`.
- Run the live manual checks in `docs/RELEASE_CHECKLIST.md`.
- Generate a fresh production Google refresh token with DeMario and confirm Admin -> Availability reports Google Calendar connected.
- Review `docs/ADMIN_HANDOFF.md` with DeMario.
- Have Mario review `docs/MARIO_ACTION_PLAN.md` and complete the live Tasks list.
- Keep the external proof for insurance, waiver/terms, cancellation, payment policy, and venue rules available outside the repo.

## Deferred P2

- Add privacy-conscious analytics after consent/cookie policy is final.
- Add 24-hour reminder emails.
- Round 2 of the yield/retention work: drilling sessions and play-with-the-pro as bookable
  formats, plus packages as a manual lesson-credits ledger on the student record. Blocked on
  DeMario's pricing, duration, and player counts.
- Add secure student cancellation/reschedule links using private email tokens, policy-aware UI/API checks, student/admin notifications, ICS cancel/update files, and manual payment/refund handling until Stripe exists.
- Add Stripe Checkout only after the pickleball business entity and banking setup exist.
- Add automated DUPR rating sync only after Mario receives official read-only API or partner access from DUPR.
- Move GitHub Actions to the Node 24 runner default before GitHub's June 2, 2026 default change.
- Upgrade dependency advisories when compatible patched versions are available; do not use `npm audit fix --force` without a tested migration branch.

## Long-Term Reference

- `RATE_LIMIT_SALT` salts both rate-limit IP hashes and review link tokens. Changing it
  invalidates every unused review link sitting in a student's inbox. Rotate only deliberately.
  It was set 2026-07-27, before any tokens had been issued, so nothing was invalidated. Before
  that it fell back to `SUPABASE_SERVICE_ROLE_KEY`, which coupled review links to the database
  credential.
- Environment variables added through the Vercel CLI are stored as sensitive and **cannot be
  read back** with `vercel env pull` — it reports them as empty. "Set" is verifiable, "set to
  the right value" is not. Verify those functionally after deploy instead of trusting a pull.

- Keep the Business roadmap focused on DeMario's operating tasks: venue routing, proof-on-file, payments, follow-ups, and growth.
- Keep `docs/MARIO_ACTION_PLAN.md`, `/admin/tasks`, and `/admin/roadmap` nontechnical enough for Mario to complete without understanding code or infrastructure.
- Keep the Developer roadmap focused on Tonio's code/ops tasks: CI, tests, monitoring, database constraints, dependency upgrades, and stale documentation.
- Before broader promotion or paid ads, complete the manual launch gates, route students according to `docs/VENUE_RULES.md`, and keep production monitoring either verified or explicitly accepted as post-launch.
- DUPR automation should wait for official DUPR API/partner access. The business roadmap tracks DeMario's request step: he should ask DUPR for an external read-only token or partner integration for `demariomontezpb.com` and send Tonio the approval email, token instructions, or partner contact. Once credentials exist, add a server-side sync for verified singles/doubles ratings.
