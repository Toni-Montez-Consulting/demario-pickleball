# Developer Implementation Plan

This is Tonio's code execution tracker. DeMario's operational business roadmap
should stay in `/admin/roadmap`.

## Current Status

- **As of 2026-08-12:** everything through PR #10 is merged and deployed to production. There
  is no code in flight. What remains is the manual gate list below, Mario's blocked inputs, and
  round 2. The binding constraint is not code: no booking has been created since 2026-07-28 and
  no review request has ever been sent, so the round 1 retention work has never been exercised
  by a real student.
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

### Site Health and SEO Pass (2026-07-27)

From the 2026-07-26 audit. Shipped in code and CI.

- Fixed a live SEO break: a trailing newline in `NEXT_PUBLIC_SITE_URL` was rendering
  `Sitemap: https://demariomontezpb.com
/sitemap.xml` in robots.txt, splitting every sitemap
  `<loc>`, and putting a literal newline in the JSON-LD `url` and `@id`. `normalizeSiteUrl`
  now trims, so output is correct regardless of the stored value.
- Set `RATE_LIMIT_SALT` so review link tokens are no longer salted with the Supabase
  service-role key. Done before any tokens were issued, so nothing was invalidated.
- An unset `CRON_SECRET` now returns a logged 500 instead of a 401, so a misconfigured cron
  cannot masquerade as a rejected caller.
- Raised `--fg-muted` from 0.55 to 0.62, then to 0.65 (PR #8). 0.62 cleared the nominal tokens
  but measured 4.37:1 against the real proof-panel card background at 11px bold, still under
  the 4.5:1 AA floor. 0.65 measures 4.92:1. Measure against the rendered colour, not the token.
- Lesson steps use `h4` instead of `h5`, which was skipping a level under `h3`.
- Added a styled 404. This matters more than it used to because the review-token page calls
  `notFound()` for used or expired links.
- The hero photo goes through `next/image` instead of a CSS `background-image`, so it gets
  avif/webp. Rendered geometry verified identical to production.
- Added cookieless Vercel Web Analytics.
- Enriched the LocalBusiness structured data with `image`, `areaServed`, `sameAs`, and an
  `employee` link to the coach node.

**Deliberately not done:** `Review`/`AggregateRating` structured data. Researched 2026-07-27 —
Google treats reviews a business collects and displays about itself as self-serving, so the
markup is ignored for rich results. It produces no stars and is not worth the surface area.

### Booking Overlap Fixes (2026-08-02)

PRs #9 and #10. Found by an adversarial audit of the round 1 merge.

- Lessons run 60/75/90 minutes against hourly slots, but availability only ever blocked the
  exact start label of an existing booking. A 90-minute clinic at 5:00 PM ran to 6:30 and left
  5:30 PM and 6:00 PM bookable, with confirmation emails to both students. `availability.ts`
  now expands bookings into intervals and reuses the overlap test the Google Calendar path
  already used.
- Added `bookings_no_overlap`, a gist exclusion constraint, as the database backstop so a bug,
  a manual insert, or a race fails loudly instead of silently double-booking a real lesson.
  See `docs/supabase-booking-overlap-migration.sql`.
- Admin status changes surface the resulting overlap conflict as a 409 instead of a bare 500.
- PR #9 converted bookings to intervals but left `blocked_slots` and `recurring_blocks` as
  single labels, so the same bug survived in the sibling path. PR #10 made blocks zero-width
  busy intervals: a lesson may end exactly when a block begins but can never run through one.
  The database constraint cannot cover this, because it only sees the `bookings` table. The
  application layer is the sole guard for blocks.

## Remaining Manual Launch Gates

Reconciled against production on 2026-08-12. The previous version of this list had gone stale
and still named migrations that shipped on 2026-07-28 and 2026-08-02.

**Verified done (queried against production Supabase, 2026-08-12).** Do not re-run these.

- `bookings_unique_active_slot`, `bookings_no_overlap`, and `admin_tasks.priority` all exist.
- The `students`, `reviews`, and `rate_limit_events` tables exist.
- The students/reviews migration ran, the `legacy` seed ran (7 rows, permissioned), and
  `scripts/backfill-students.mjs` ran: 5 bookings, 3 students, 0 unmatched.
- 15 active time slots are configured.

**Still open.**

- Verify anon users cannot read or write `bookings`, `inquiries`, or `rate_limit_events`.
  The policies are in place; proving it needs a real anon-key request, not a query.
- Confirm the daily cron appears in the project's Cron Jobs tab and that `CRON_SECRET` is set.
  The route logs a 500 when the secret is missing, so the function logs are the proof.
- Run the live manual checks in `docs/RELEASE_CHECKLIST.md`, including the new overlap check.
- Generate a fresh production Google refresh token with DeMario and confirm Admin ->
  Availability reports Google Calendar connected.
- Submit one real review end to end and publish it from Admin -> Reviews. Blocked below.
- Review `docs/ADMIN_HANDOFF.md` with DeMario.
- Have Mario review `docs/MARIO_ACTION_PLAN.md` and complete the live Tasks list.
- Keep the external proof for insurance, waiver/terms, cancellation, payment policy, and venue
  rules available outside the repo.

**The review loop is unproven in production.** As of 2026-08-12, `review_request_sent_at` is
null on all 5 bookings, all 7 `reviews` rows are `legacy` seeds from 2026-07-26, and there have
been no new bookings since 2026-07-28. This is not a defect: the cron only asks on a booking
with status `confirmed`, at least 24h past the lesson date, inside a 30-day lookback, and the
only lesson in that window (2026-07-25) is still `pending` because nobody confirmed it in
Admin. Round 1's centrepiece is built and unit tested but has never run against a real student.
Treat that as the gate, not as more code to write. See `docs/LAUNCH_OUTSTANDING.md`.

## Deferred P2

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
