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

Each branch is based on the one before it. Every one passed `npm run ci` and the full
Playwright suite locally before push. Each merges cleanly with open PR #11 in either order.

| # | Branch | What it does |
|---|---|---|
| 1 | `fix/dupr-rankings` | The update DeMario asked for: rating, rankings, USPTA, linked TeachMe.To rating, Dallas ISD and Carrollton roles, no Head Pro title |
| 2 | `chore/security-patches` | Next 16.4.2, production audit to 0, CI on Node 24, `agentRules: false` |
| 3 | `fix/lead-alerts` | Inquiry emails to Mario; booking emails via `after()`; email title escaping |
| 4 | `fix/a11y-perf-seo` | Every live-audit finding in section 3 |
| 5 | `feat/conversion-tracking` | Ten privacy-safe custom events; see `docs/ANALYTICS.md` |
| 6 | `feat/lesson-outcome-nudge` | Morning digest with one-tap outcomes, which makes the review loop run |

## 7. Remaining

For Tonio:
- Open PRs, review, and merge in order. Nothing here is merged or deployed.
- Vercel: confirm Web Analytics is enabled.
- Vercel: set `LESSON_OUTCOME_SECRET` (Production) and redeploy.
- Vercel: set the `www` domain to a permanent (308) redirect; it is 307 today.
- Supabase: enable leaked password protection.
- Read the three inquiries already in Admin; the newest is 2026-10-18.
- Later, on a separate tested branch: a CSP, and HSTS `includeSubDomains`.

For DeMario:
- Instagram handle, and which address to use.
- A 2000px+ hero photo (the current one is 828px wide).
- Whether 8 AM and three reminders suit him, and how "Didn't happen" fits lessons he moves by
  text.
- Confirm or record the 3 past-dated pending bookings in Admin -> Needs outcome.
