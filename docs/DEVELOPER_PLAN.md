# Developer Implementation Plan

This is Tonio's code execution tracker. DeMario's operational business roadmap
should stay in `/admin/roadmap`.

## Current Status

- **As of 2026-10-19:** the October round (PRs #12 to #19) is merged; see "October 2026 Audit
  Round" below. The binding constraint has not moved: of 8 bookings only 1 was ever confirmed,
  and no review request has been sent (aggregate counts, 2026-10-18). #18's morning outcome
  digest targets exactly that. `LESSON_OUTCOME_SECRET` was set in Production later on
  2026-10-19, so the digest is on; it sends only when a site-booked lesson from the last three
  days is still pending.
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

**Verified 2026-10-19, so off this list:** anonymous access is blocked, both crons are
registered, and Google Calendar blocking works without a new token. Evidence:
`docs/LAUNCH_OUTSTANDING.md`, "Verified 2026-10-19".

**Still open.**

- Run the live manual checks in `docs/RELEASE_CHECKLIST.md`, including the new overlap check.
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
Treat that as the gate, not as more code to write. See `docs/LAUNCH_OUTSTANDING.md`. Still true
on 2026-10-18 (8 bookings, 1 confirmed, 0 review requests); #18 is the response.

## Deferred P2

- Add 24-hour reminder emails.
- Round 2 of the yield/retention work: drilling sessions and play-with-the-pro as bookable
  formats, plus packages as a manual lesson-credits ledger on the student record. Blocked on
  DeMario's pricing, duration, and player counts.
- Add secure student cancellation/reschedule links using private email tokens, policy-aware UI/API checks, student/admin notifications, ICS cancel/update files, and manual payment/refund handling until Stripe exists.
- Add Stripe Checkout only after the pickleball business entity and banking setup exist.
- Add automated DUPR rating sync only after Mario receives official read-only API or partner access from DUPR.
- Upgrade dependency advisories when compatible patched versions are available; do not use `npm audit fix --force` without a tested migration branch.

## October 2026 Audit Round

Six stacked PRs, merged on 2026-10-19 in this order: #13 `fix/dupr-rankings`, #14
`chore/security-patches`, #15 `fix/lead-alerts`, #16 `fix/a11y-perf-seo`, #17
`feat/conversion-tracking`, #18 `feat/lesson-outcome-nudge`. They reached production the same
day in one deployment (`dpl_5scgTq8n43n4uqBxmGYiogUZkDee`, master `30c99be`), started by hand
because pushes to master no longer deploy (`docs/SETUP.md` section 8). The audit evidence is
`docs/plans/2026-10-19-audit-and-enhancements.md`, added by #12. A follow-up the same day, #19,
restored the sticky nav's blur outside Safari (`dpl_45DWEAsGRKowFhXRhV63XpuPTAjx`).

### 1. `fix/dupr-rankings` — credentials update (2026-10-19)

- Doubles DUPR 4.702 -> 4.973 in the hero (4.97), trust strip, About stat, and meta description.
  DeMario's own TikTok reads "4.973 currently", which matches his update.
- Added his rankings: top 1% of DUPR-rated players worldwide and in Texas (hero), top 100 in
  Texas and top 40 in DFW (trust strip, bio, About stat), with an "as of October 2026" note.
- The rating, rankings, and as-of date live in `src/lib/dupr.json`. Every surface reads from
  it, so a new rating is one edit there.
- Dropped the 4.579 singles rating in its own commit (`ccb49b7`). DeMario confirmed doubles only
  for now. If he gets back into singles, re-add the stat by hand using that commit as the layout
  reference. Do not `git revert` it: later commits rewrote the same bio paragraph, and the
  revert's side of the conflict brings back "USTA" and "Head Pro".
- Corrected USTA -> USPTA (confirmed by Tonio).
- The trust strip's first chip links to his TeachMe.To reviews: 5.0 from 137+ ratings,
  checked October 2026. It replaces the unsourced "5.0 / 79 reviews" claim removed in July.
- Removed the "Head Pro at Dallas Indoor Pickleball Club" title at DeMario's request. The hero
  tag, About photo badge, and structured-data `jobTitle` now read "Pickleball Coach"; the bio
  clause and trust chip are gone. Dallas Indoor stays on the site as a PodPlay venue.
- Added his instructor roles for Dallas ISD and the City of Carrollton, at his request: one
  sentence in the bio and two trust chips in the old Dallas Indoor slot.
- The trust strip now wraps into centered rows from 768px up. At nine chips, with its scrollbar
  hidden, a mouse could not reach the chips past the edge. Phones keep the swipeable row.
- **Not added:** Spanish-language lessons. His TeachMe.To profile lists Spanish; add it to the
  site only once DeMario confirms he wants to offer it here.

### 2. `chore/security-patches` — dependency and CI patch round (2026-10-19)

- `next` 16.2.4 -> 16.4.2. 16.2.4 carried 30 advisories, including three critical RCEs (one in
  the AVIF image optimizer this site enables, one in `next/og`). `npm audit --omit=dev` is now 0.
- `@sentry/nextjs` 10.50 -> 10.76, `resend` 6.12 -> 6.34, `@supabase/supabase-js` within ^2,
  `vitest`/`@vitest/coverage-v8` 4.1.5 -> 4.1.12. Removed the `postcss` and `svix` overrides
  now that upstream carries the fixes.
- CI moves to Node 24 (matching Vercel) on `actions/checkout@v7` and `actions/setup-node@v7`.
- `agentRules: false` in `next.config.ts`: Next 16.4's `next dev` otherwise appends a generated
  block to the hand-maintained `AGENTS.md` every time an AI agent runs the dev server.
- Node 24.x is declared in `engines` and `.nvmrc`. The new `@supabase/supabase-js` throws on
  Node 20, so local development needs Node 22 or newer.
- `next-env.d.ts` is gitignored, and `npm run typecheck` runs `next typegen` first. Next 16.4
  rewrote the tracked copy on every dev or build run.
- The Sentry config import moved to `@sentry/nextjs/config`; the Vitest config is now
  `vitest.config.mts`. Both clear deprecation warnings from this round's upgrades.
- Details, the remaining dev-only ESLint advisory, and the Sentry 11 to-do:
  `docs/DEPENDENCY_ADVISORIES.md`.

### 3. `fix/lead-alerts` — Mario hears about every lead (2026-10-19)

- Contact-form inquiries now email Mario (Reply-To is the student). Before this they only
  appeared in `/admin`, while the form promised a reply within 24 hours.
- The booking, inquiry, cancellation, and admin-feedback emails run in `after()` instead of a
  bare un-awaited promise that serverless could freeze after the response. The booking email
  is Mario's only new-booking alert; the cancellation email is the student's only notice.
- Failed sends report to Sentry. The Resend SDK returns errors rather than throwing, so a
  revoked key or spent quota used to fail with only a console line.
- Mario's alerts retry once without Reply-To when Resend rejects the student's address. The
  address stays in the body.
- Inquiry alerts stop after 20 in 24 hours (messages still save to `/admin`, and Sentry gets
  one warning), so contact-form spam cannot spend the Resend quota booking emails need.
- Fixed an HTML injection: the email wrapper put the heading (the student's name, on admin
  notifications) into `<title>` unescaped, so a crafted booking name could inject a link into
  Mario's inbox. Names are also kept to one line in every subject.
- **After deploy:** the three inquiries already in production (newest 2026-10-18) were never
  emailed. Read them in Admin -> Inquiries.

### 4. `fix/a11y-perf-seo` — live-audit fixes (2026-10-19)

From the 2026-10-19 live audit (Lighthouse mobile 92/100/100/100, desktop 100s; axe; Playwright).

- **Booking dialog focus trap:** the honeypot input (tabIndex -1, aria-hidden) was the trap's
  "last" element, so Tab walked out of the open dialog. Fixed, with an e2e test that fails on
  the old code.
- **Sticky nav never stuck:** `.device { overflow: hidden }` made `.device` the sticky
  container. `overflow: clip` fixes it with identical layout (measured), and
  `scroll-padding-top` keeps `#lessons` / `#about` / `#contact` below the nav.
- **Cookie notice:** the desktop Book pill no longer covers it; on mobile it scrolls away
  instead of covering 72px of every screen.
- **LCP:** the hero uses `loading="eager"` + `fetchPriority="high"` (Next 16 deprecated
  `priority`); the offscreen About portrait is no longer preloaded; every `sizes` value
  matches its measured render width.
- **Link previews:** 1200x630 card at `public/img/og-card.jpg`. The script reads
  `src/lib/dupr.json`, so rerun `node scripts/generate-og-image.mjs` after any rating update.
  Both image scripts refuse to write if the brand fonts fail to load.
- **SEO:** per-page title, canonical, and og:url via `src/lib/metadata.ts`. The root layout
  keeps only site-wide preview fields, so pages without their own (a `/review` link, the 404)
  no longer preview as the homepage. `/pay` is noindex and out of the sitemap. The legal
  pages' lastmod dates are the dates their text last changed, set in `src/app/sitemap.ts`.
- **Accessibility:** `<main>` landmarks, `/pay` heading order, 24px tap targets on the review
  dots and footer links, and the sticky bar is inert while hidden. axe-core: 0 violations on
  `/`, `/pay`, `/privacy`, `/terms`.
- **Icons:** `favicon.ico` and the Apple touch icon (`node scripts/generate-icons.mjs`).
- **Not done here:**
  - The hero photo is only 828px wide; it needs a 2000px+ original from DeMario.
  - `www` -> apex returned 307. Done outside the code on 2026-10-19: `www` is now a 308
    redirect in Vercel Domains.
  - CSP and HSTS `includeSubDomains` came later, on their own tested branch
    (`fix/security-headers`); see `src/lib/security-headers.ts`. The policy allows inline
    scripts because Next's App Router writes page data inline; nonces would force every page
    to render on demand and lose the CDN cache. The Playwright test runs against `next dev`,
    so it exercises the development policy; unit tests pin the production directives, and the
    live site got a browser pass after the deploy. The Vercel Toolbar's sources are allowed
    on previews only, so the toolbar does not load on production for team members either.
  - `tel:` links have no `+1`; US numbers dial fine, so they were left alone.
  - JSON-LD says Farmers Branch while the footer says Dallas. Mario should pick the address
    for local search.
  - The Instagram link (`@Alexanderiio`) does not match his name. Mario should confirm it.

### 5. `feat/conversion-tracking` — privacy-safe funnel analytics (2026-10-19)

- Ten custom events cover the booking funnel, partner-platform and contact handoffs (the
  conversions this site's database never sees), payment link opens, and the contact and review
  form results. Catalog and dashboard instructions: `docs/ANALYTICS.md`.
- Properties are closed-set codes enforced by TypeScript, at most two per event (the Vercel
  Pro limit). An e2e test proves the booking funnel's events never contain what the student
  typed.
- `booking_created` is server-side, so only saved bookings count. It sends no cookies, unlike
  the library default. In production it posts to the custom domain: the library's default
  `*.vercel.app` target sits behind Vercel Authentication on this project, which silently
  dropped every server event.
- Each booking step counts once per opening of the form, so step totals read as a funnel.
  Middle clicks count as link clicks; a saved booking whose response body is lost still shows
  the confirmation.
- The event list and court-setup codes are compiler-checked, and a unit test fails if a
  partner venue's name stops mapping to a code.
- Privacy policy (now "Updated October 19, 2026") and cookie notice disclose the interaction
  counts. The site roadmap marks analytics shipped.
- **Web Analytics was enabled on 2026-10-19 at 21:04 UTC,** after the query API had said "not
  found" for this project earlier that day. Data starts with the first deployment after that.

### 6. `feat/lesson-outcome-nudge` — make the review loop run (2026-10-19)

Spec: `docs/specs/2026-10-19-lesson-outcome-nudge.md` (written first, per the Interface
Origination Rule).

- Daily cron `/api/cron/lesson-outcomes` at 13:00 UTC emails Mario one digest of site-booked
  lessons from the last three Central days that are still `pending`. It sends nothing when
  nothing is pending.
- Each lesson has three signed links: Lesson happened, No-show, and Didn't happen. A link opens
  `/lesson-outcome/[token]`. Only that page's button (a POST) changes anything, and only from
  `pending`. Tokens are HMAC-SHA256 with a dedicated secret and expire after 14 days. A replay
  is a no-op.
- This deliberately bypasses admin MFA for one narrow transition. The spec's limitations check
  records why and how it is bounded.
- Admin gets a **Needs outcome** filter (pending, lesson date passed). Once a lesson has
  started, its Cancel button reads **Didn't happen**, and the server sends no cancellation
  email for it, so clearing old lessons cannot email a student about one from months ago.
- The confirmation page states what each outcome means: No-show and Didn't happen are final,
  and "Lesson happened" promises a review request only when the booking has a student record.
  It no longer claims Admin can change a recorded outcome.
- A tap that fails (rate limit, database error) returns to the page with a "didn't save"
  alert instead of raw JSON, and tokens are shape-checked before use.
- `dateInTimeZone` replaces three identical private copies (availability, the booking day
  list, and Admin's today).
- **Live since 2026-10-19:** `LESSON_OUTCOME_SECRET` is set in Vercel Production. Steps 4 to 7
  of the Lesson Outcome Nudge section of `docs/RELEASE_CHECKLIST.md`, a test booking through
  the digest, are still open.
- **Open for DeMario:** is the digest time right (13:00 UTC: 8 AM Central now, 7 AM after
  daylight saving ends) with three reminders, and does "Didn't happen" fit how he moves
  lessons by text?

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
