# October 2026 Audit and Enhancement Round

Audited 2026-10-18 to 2026-10-19 by Claude (Claude Code) for Tonio. This file records the
evidence and the decisions. The work itself is six stacked branches, listed below in merge
order.

Method: read-only throughout.
- **Production database:** aggregate counts and dates only, with no student names, emails,
  or phones pulled.
- **Live site:** Lighthouse, axe-core, and Playwright. Analytics requests were blocked and
  no form was submitted.
- **Vercel:** deployments, runtime errors and logs, and the analytics API.
- **Dependencies:** `npm audit` and `npm outdated`.
- **Public profiles:** for fact-checking the site's claims.

## 1. Usage (production Supabase, 2026-10-18)

| | Count | Notes |
|---|---|---|
| Bookings | 8 | First 2026-04-25, latest 2026-10-18. 2 are April test bookings. |
| … confirmed | 1 | The only booking ever confirmed (lesson 2026-05-05). |
| … pending | 5 | **3 with lesson dates long past** (2026-05-22, 07-25, 08-26). 2 upcoming (10-19, 10-22). |
| … cancelled | 2 | Both April tests. |
| … marked paid | 0 | |
| … review request sent | 0 | **The review loop has never run.** |
| Inquiries | 3 | 2026-05-25, 08-25, 10-18. **None emailed Mario.** They only appeared in `/admin`. |
| Reviews | 7 | All `legacy` seeds. 9 rate-limited review submissions, all from one IP on deploy days, were tests. |
| Students | 6 | |
| Blocked slots / recurring blocks | 0 / 0 | Admin availability tools are unused. |

Reading of the numbers:
- The site is a low-volume channel. Most lessons are booked on TeachMe.To and PodPlay, which
  this database never sees.
- Mario does not work in `/admin`. Nothing confirms bookings, so the review loop, which only
  asks about confirmed bookings, is starved.
- Contact messages went unseen.

## 2. Analytics

- `@vercel/analytics` has shipped since 2026-07-27 and `/_vercel/insights/script.js` is
  served, but the Vercel query API answered **"Web Analytics not found"** for the project. The
  numbers could not be read from here. **Open Vercel -> Analytics to confirm it is enabled.**
- The team is on Vercel **Pro**: custom events are included, at most 2 properties each.
- Before this round only pageviews existed. Nothing measured the booking funnel or the
  handoffs to partner platforms.

## 3. Live site (Lighthouse 12.8, axe-core 4.11, Playwright; 2026-10-19)

| | Perf | A11y | BP | SEO | LCP |
|---|---|---|---|---|---|
| Mobile | 92 | 100 | 100 | 100 | 3.0s |
| Desktop | 100 | 100 | 100 | 100 | 0.6s |

Findings fixed in `fix/a11y-perf-seo`:
- The booking-dialog focus trap leaked (32 of 40 Tab presses landed outside).
- The sticky nav never stuck (`overflow: hidden` on `.device`).
- The cookie notice was covered on desktop and pinned on mobile.
- The hero lacked `fetchpriority`, and an offscreen photo was preloaded.
- The About section's `sizes` values were wrong (a 640w file at 972px).
- The link preview was a portrait image.
- There was no canonical, and the subpages reused the homepage metadata.
- `/pay` was indexed.
- No `<main>` landmark (57 axe nodes).
- `/pay` heading order was wrong.
- The review dots were 3px tap targets.
- `favicon.ico` and the Apple touch icon returned 404.

## 4. Security

- **`next@16.2.4`: 30 advisories**, including three critical RCEs: the AVIF image optimizer
  (enabled here), `next/og`, and Windows hosts. There were also Middleware/Proxy bypasses.
  Total `npm audit --omit=dev`: 23 (1 critical, 8 high). Fixed in `chore/security-patches`
  (Next 16.4.2; production audit now 0).
- **HTML injection in admin emails:** the email `<title>` was unescaped, and the admin booking
  notification put the student's name there. Fixed in `fix/lead-alerts`.
- **Supabase advisors**, with dispositions:
  - `rls_auto_enable()` executable by anon. It is an event-trigger function, so a direct RPC
    call fails. Low; revoking EXECUTE is optional hygiene.
  - `booking_minutes` and `booking_duration` have a mutable `search_path`. They are not
    SECURITY DEFINER. Low; `set search_path = ''` when next touching them.
  - `btree_gist` is in the public schema. Low.
  - **Leaked password protection disabled.** It is a toggle in Supabase Auth settings, and
    worth turning on for the admin accounts.
  - RLS enabled with no policy on `rate_limit_events`, `reviews`, and `students`. Intended:
    these are service-role only.
  - Unindexed FKs on `reviews`, unused indexes, and duplicate permissive SELECT policies.
    Negligible at this size.
- CI tested on Node 20 (EOL) while production runs Node 24. Moved to Node 24.

## 5. Content accuracy (public profiles, 2026-10-19)

| Site said | Evidence | Action |
|---|---|---|
| 4.70 doubles / 4.58 singles DUPR | DeMario: 4.973 doubles; his TikTok: "4.973 currently" | Updated; singles removed in its own commit (DeMario: doubles only for now) |
| — | DeMario: top 1% worldwide and in Texas, top 100 Texas, top 40 DFW | Added, dated October 2026 |
| "USTA certified" | Search snippet of TeachMe.To: "USPTA Certified (PB)"; Tonio confirmed | Corrected to USPTA |
| (unsourced 5.0 claim removed in July) | TeachMe.To: 5.0 from 137 ratings, 243 lessons | Linked chip added |
| "Head Pro at Dallas Indoor" | DeMario asked to remove it | Removed; the hero tag and About badge now read "Pickleball Coach" |
| (not mentioned) | DeMario: pickleball instructor for Dallas ISD and the City of Carrollton | Added to the bio and trust strip |
| (not mentioned) | TeachMe.To: speaks English and Spanish | Not added; Tonio left it off |
| Instagram `@Alexanderiio` | Handle does not match his name | **Ask DeMario** |
| Address Farmers Branch (JSON-LD, About) vs Dallas (footer) | — | **Ask DeMario which to use for local search** |

## 6. Branches, in merge order

Each branch is based on the one before it and is open as a PR. A code review of every PR on
2026-10-19 raised 51 findings. The real ones were fixed on the PR they belong to, and each PR
description lists them.

Verification:
- Every branch passed `npm run ci` locally with its own lockfile.
- The Playwright suite passed locally on every branch's code. One run on `fix/lead-alerts` was
  lost to the Turbopack font start-up failure in `docs/DEPENDENCY_ADVISORIES.md`; its code
  passed inside the next branch's run.
- GitHub CI runs the full suite on each PR.
- Each branch merges cleanly with open PR #11 in either order.

| # | PR | Branch | What it does |
|---|---|---|---|
| 1 | #13 | `fix/dupr-rankings` | The update DeMario asked for: rating, rankings, USPTA, linked TeachMe.To rating, Dallas ISD and Carrollton roles, no Head Pro title. The numbers live in `src/lib/dupr.json` |
| 2 | #14 | `chore/security-patches` | Next 16.4.2, production audit to 0, CI and `engines` on Node 24, `agentRules: false` |
| 3 | #15 | `fix/lead-alerts` | Inquiry emails to Mario; every email sent in `after()` and failures reported to Sentry; a daily inquiry-alert cap; email title escaping |
| 4 | #16 | `fix/a11y-perf-seo` | Every live-audit finding in section 3, plus per-page link previews |
| 5 | #17 | `feat/conversion-tracking` | Ten privacy-safe custom events; see `docs/ANALYTICS.md` |
| 6 | #18 | `feat/lesson-outcome-nudge` | Morning digest with one-tap outcomes, which makes the review loop run, and a silent "Didn't happen" in Admin |

## 7. Remaining

**Shipped 2026-10-19.** #12 to #18 are merged and live in one production deployment
(`dpl_5scgTq8n43n4uqBxmGYiogUZkDee`, `master` at `30c99be`). After the deploy:
- Read-only smoke checks passed 30 of 30; the same checks passed 14 of 30 on the old build.
- A browser pass at 320, 375, and 1280px passed 28 of 28.
- Vercel showed no runtime errors (checked 18:13 UTC).

#19 fixes the sticky nav's blur outside Safari. The CSS build had dropped it, which predates
this round; it showed once #16 made the nav stick. It went live at 19:52 UTC in
`dpl_45DWEAsGRKowFhXRhV63XpuPTAjx` (`master` at `3aabb05`):
- The smoke checks and browser pass again passed 30 of 30 and 28 of 28.
- The stuck nav's computed `backdrop-filter` reads `blur(14px)`; it was `none`.

#11, the August launch reconciliation, was brought up to date and merged. It is docs only.

Also done on 2026-10-19: Supabase `rls_auto_enable()` no longer grants `EXECUTE` to
`public`, `anon`, or `authenticated` (migration `revoke_public_execute_on_rls_auto_enable`),
which clears two advisor warnings. A probe table created afterwards still got RLS from the
`ensure_rls` trigger.

For Tonio:
- Vercel: reconnect Git. Pushes to `master` stopped deploying when the project moved to the
  Toni Montez Co team, so this round was deployed by hand. Steps: `docs/SETUP.md` section 8.
- Vercel: confirm Web Analytics is enabled. The analytics API answers "not found" for this
  project.
- Vercel: set `LESSON_OUTCOME_SECRET` (Production only) and redeploy. The token used on
  2026-10-19 could deploy but could not write production env vars or domains.
- Vercel: add `www.demariomontezpb.com` to the project as a redirect to `demariomontezpb.com`
  with status 308. `www` is not attached to any project, and Vercel's fallback answers 307.
- Supabase: turn on leaked password protection in the Auth settings; the Pro plan includes it.
- Supabase: drop the empty table `public.zz_rls_probe_20261019`, left by the check above. The
  agent's tool needs a person to confirm a drop. RLS is on with no policies, so nothing can use
  it meanwhile.
- Read the three inquiries already in Admin; the newest is 2026-10-18.
- Later, on a separate tested branch: a CSP, and HSTS `includeSubDomains`.
- **Waiver version.**
  - On 2026-04-28 the liability release changed: it now names "host venues, and court
    providers" instead of Dallas Indoor. A court-fee clause was also added.
  - `WAIVER_VERSION` is still `2026-04-24`, and the terms page still says "Effective April 23,
    2026".
  - Every booking since then records a version whose text the student did not see.
  - Decide with whoever advises on the waiver before changing either.
- Recommended: self-host Inter and Space Grotesk with `next/font/local`. That ends the
  intermittent `next dev` start-up failure caused by Google Fonts responses, which failed one
  GitHub CI run on 2026-10-19 (#11; it passed on re-run). Keep today's per-subset
  `unicode-range` split and check the typography renders the same.

For DeMario:
- Instagram handle, and which address to use.
- A 2000px+ hero photo (the current one is 828px wide).
- Whether a 7–8 AM digest (13:00 UTC) and three reminders suit him, and how "Didn't happen"
  fits lessons he moves by text.
- Confirm or record the 3 past-dated pending bookings in Admin -> Needs outcome.
