# Full Audit Prompt: DeMario Montez Pickleball

**Version 2, 2026-10-23.** Replaces the April 2026 launch checklist, which seeded data, fixed
as it went, and pushed to `master`. This version is read-only and covers the whole business
and the whole system.

**How to use:** start a new Claude Code or Codex session in the repository root
(`C:\Users\tonimontez\demario-pickleball-1`) and say: "Run `docs/AUDIT_PROMPT.md`." The
session produces one private report and changes nothing. Fixes come afterwards, as normal
pull requests, once Tonio has read the report.

This file is public. It lists checks, never results.

---

## 0. Mission

You are auditing demariomontezpb.com, the booking site and operating system for DeMario
Montez's pickleball coaching business in Dallas–Fort Worth, and the business it serves.

Find everything that is broken, risky, inaccurate, missing, or holding the business back, in
both business and technology. Rank each finding by what it costs DeMario (students, money,
reputation, time) and what it costs Tonio, who builds and runs the site (maintenance, risk).
Then say what to do first.

You are not here to fix anything.

**Done means all of these are true:**

1. Every check ID in section 6 (A1 to J7) appears in the report's check ledger. Each is
   marked passed, a finding, or not checked, with one line of evidence or the reason it could
   not be checked.
2. Every finding has evidence that someone else can re-run. Section 9's verification pass has
   re-run that evidence and recorded the output.
3. The feature inventory, metrics snapshot, and Systems Health Review are filled in.
4. The report is saved at the private path in section 10. You have posted a summary of 15
   lines or fewer, with the path, in the chat.
5. The only files you wrote are that report and scratch files in your session's scratch
   directory. You made no other writes of any kind (section 1).

---

## 1. Ground rules (non-negotiable)

### What you audit

1. **One pinned revision.** `git fetch` is allowed. In Phase 0, record the `origin/master`
   SHA, and audit exactly that.
   - Read it with `git show <sha>:<path>` or `git grep <pattern> <sha>`, or in a separate
     worktree in your scratch directory (`git worktree add <scratch>/audit <sha>`).
   - In the main working tree, never `checkout`, `switch`, `stash`, `reset`, `clean`, `pull`,
     `merge`, `rebase`, `commit`, or `gh pr checkout`. It may hold someone's unfinished work.
2. **Open PRs are pending changes.** Read their diffs with `gh pr diff`. Say what each would
   change, and audit what is live.

### What you must never do

3. **No writes, anywhere.** None of these, even when one looks harmless:
   - **Git and GitHub:** commits, pushes, merges, branch changes, PR comments, reviews,
     labels, settings, or workflow runs.
   - **Database:** `insert`, `update`, `delete`, DDL, `rpc`, migrations, branches, or
     pause/restore. Wrap every query as
     `begin transaction read only; <select>; rollback;`.
   - **Vercel:** deploy, redeploy, promote, rollback, env changes, `vercel pull`,
     `vercel env pull`, `vercel link`, share links, firewall, flag, or route edits.
   - **Supabase CLI:** `supabase link`, `db push`, or `db reset`.
   - **Other services:** any setting in Resend, Google Cloud, the registrar, or DNS.
4. **No requests that change state on the live site or a preview.** No `POST`, `PUT`,
   `PATCH`, or `DELETE`, even malformed: the rate limiter records each attempt in the database
   before validating it. Cron routes get at most an unauthenticated `GET` (it must answer 401).
   Never open a link that acts on a real booking or review. Never sign in to `/admin`.
   - Admin screens, sessions, and cookies are audited from code and tests only.
5. **Your machine is wired to production.**
   - `.env.local` holds live credentials. Never open any `.env*` file except
     `.env.local.example`.
   - In the main working tree, never run `npm run dev`, `next start`, `npm run test:e2e`, or
     anything in `scripts/`.
   - Any local run happens only in the scratch worktree, with exactly the dummy environment
     from `.github/workflows/ci.yml` and no other app variables set.
   - If dependencies will not install, the latest CI logs (`gh run view --log`) are your test
     evidence.
6. **Keep DeMario's analytics clean.** Browse the live site only with automated browsers:
   Playwright, or Lighthouse in headless mode. The live analytics script skips automated
   browsers. Confirm it from each run's network log: zero requests to the analytics endpoint,
   or discard the run.
   - For Lighthouse, also block the analytics script's directory (at audit time it looks like
     `/<16 hex characters>/script.js`; read it from the page) and `*/_vercel/insights/*`.
   - Never drive a real browser or a browser extension on the live site.
   - Never give the live URL to a hosted tester such as PageSpeed or a structured-data
     validator. Paste the extracted HTML or JSON-LD instead.

### What you may write down

7. **Secrets are names only.** List env var names and where they are set. Never print or copy
   a value, token, key, or connection string. If a tool echoes one, leave it out of every
   output.
8. **No personal data in any output.** This covers SQL results, runtime logs, Resend's message
   lists, Sentry events, and analytics.
   - Report counts and dates.
   - Refer to a booking by the first 8 characters of its ID and its lesson date. Never use a
     name, email, phone, or review text.
9. **Security stays private.** Security findings, and anything an attacker could use, go only
   in the private report: never in the repo, a PR, an issue, a commit, or a gist.

### How you judge

10. **Evidence or it is not a finding.** Each finding needs at least one of:
    - a file and line;
    - a command with its trimmed output;
    - a URL with the observed response;
    - a query with its aggregate result.

    Label each **Confirmed** (reproduced, or proven from code and data) or **Plausible**
    (strong evidence, not reproduced). Hunches go under Questions.
11. **Fail loud.** Anything you could not check is "not checked", with the reason. Never turn
    a skipped check into a pass, and never report "no issues" for an area you did not
    inspect.
12. **Current facts from primary sources.** Before a version, plan limit, price, law, platform
    policy, or vendor behavior drives a finding, check it against current primary
    documentation, and cite the URL and the date you read it. Your training data is not a
    source.
13. **Code and live behavior beat docs.** When a doc disagrees with the code or the live
    site, report the drift as a finding.
14. **Settled decisions are not findings.** Section 3 lists them. You may flag a real risk in
    one, once, labeled "Risk in a settled decision", with evidence.
15. **Ask, don't guess.** If a check needs access or a fact only Tonio or DeMario has, write
    the question down, keep going, and list the questions at the end.

### How you work

16. **Checkpoint as you go.** Append findings and check results to the private report as you
    work. After any context compaction, re-read the report before continuing.
17. **Time-box web research** (A3 and J3) to about 30 minutes each.
18. **Environment notes:** if `private/AUDIT_ENV_NOTES.md` exists, read it first. It holds
    this machine's tool quirks and account details. It is not in the public repo.

---

## 2. Context (verify it; do not trust it)

### The business

- **Owner and coach:** DeMario Montez (students may also know him as Mario). He works from
  his phone and acts on email buttons. He does not use the admin dashboard, and he often
  cancels or moves lessons by text.
- **Builder and operator:** Tonio (Toni Montez), who owns the code and runs the platform
  accounts.
- **Goal (2026-10-22):** more students first, then higher prices.
  - The students he wants more of: groups (bring your own, or join one), adult and older-adult
    beginners, and competitive adults who do not want to go pro.
  - He has open teaching hours and roughly two hours a week for marketing.
- **Where students come from:** mostly TeachMe.To, then word of mouth, Instagram and TikTok
  (his bios link to the site), people he meets at courts, the venues he teaches at, and his
  school programs. The site is a small channel. Lessons booked on TeachMe.To and on venue
  apps never reach this database.
- **Constraints that shape the product:**
  - TeachMe.To's terms.
  - The FTC's rule on consumer reviews and testimonials (16 CFR Part 465).
  - Venue routing: indoor courts are booked through the venue's own system
    (`docs/VENUE_RULES.md`, `src/lib/venue-rules.ts`).
  - The coaching terms and waiver (`src/components/TermsContent.tsx`, and `WAIVER_VERSION` in
    `src/lib/business.ts`).
  - Payment is offline: Cash App, Zelle, and PayPal, with the booking ID in the memo
    (`src/components/PaymentOptions.tsx`).

### The system (verify versions in `package.json` and on the platforms)

- **App:** a single Next.js App Router app (React, TypeScript). `src/proxy.ts` refreshes admin
  sessions.
- **Hosting:** Vercel, deployed from Git on merge to `master`. Scheduled jobs are in
  `vercel.json`.
- **Data:** Supabase Postgres with row-level security (RLS).
  - Server code uses the service-role key.
  - Public pages never call Supabase from the browser.
  - Admin login and MFA run in the browser with the anon key, so RLS is the barrier there.
- **Email:** Resend, sending from `bookings@demariomontezpb.com`. Every "admin" email goes to
  the first address in `ADMIN_EMAIL`, which also serves as the admin allowlist.
- **Calendar:** Google Calendar FreeBusy through OAuth. It is used only when
  `GOOGLE_CALENDAR_SYNC_ENABLED` is set to `true`; otherwise busy times are skipped.
- **Analytics:** Vercel Web Analytics, cookieless, with closed-set custom events
  (`docs/ANALYTICS.md`, `src/lib/analytics.ts`).
- **Errors:** Sentry is wired in code; whether production receives events is to be verified.
- **CI:** GitHub Actions (`.github/workflows/`) plus CodeQL.

### Read these first, in this order

1. `AGENTS.md`
2. `docs/LAUNCH_OUTSTANDING.md`
3. `docs/DEVELOPER_PLAN.md`
4. `docs/ADMIN_HANDOFF.md` and `docs/MARIO_ACTION_PLAN.md`: what DeMario is told to do.
5. `docs/ANALYTICS.md`, `docs/VENUE_RULES.md`, `docs/RELEASE_CHECKLIST.md`, and
   `docs/SETUP.md`.
6. Every file in `docs/specs/` and `docs/plans/`. These are the intended behavior that the
   code is checked against. `docs/plans/2026-10-19-audit-and-enhancements.md` is the last
   audit's method and results.

---

## 3. Settled decisions (do not reopen; rule 14)

| Date | Decision | Who |
|---|---|---|
| 2026-10-19 | DUPR shown as doubles only; the title is "Pickleball Coach", not "Head Pro" | DeMario |
| 2026-10-19 | Spanish is left off the site unless DeMario says yes | Tonio |
| 2026-10-20 | Dallas is the primary area, with DFW listed. Instagram is `@demario.montez` | DeMario |
| 2026-10-20 | No Google Business Profile for now | DeMario |
| 2026-10-20 | Group Clinic stays as is. Play with the Pro blocks 1 hour. The booker pays the group total | DeMario, Tonio |
| 2026-10-20 | Group formats launched on the clinic's waiver precedent: only the booker accepts the terms. The wider question is open for whoever advises on the waiver | Tonio |
| 2026-10-22 | A review from the emailed link goes live at once, at any rating. Public-page reviews wait for DeMario's one-tap Publish. Takedown is only for abusive, fake, or untrue reviews | Tonio |
| 2026-07 and 2026-10-22 | All seven homepage testimonials are real students. DeMario confirmed the three featured ones, with permission, in July. Tonio confirmed the four on the review wall on 2026-10-22; permission to quote them was not recorded | DeMario, Tonio |
| 2026-10-23 | The day-before reminder is part of managing a booking (no opt-in), and the privacy policy says so | Tonio |
| 2026-10-23 | Parked (listed in `docs/LAUNCH_OUTSTANDING.md`): scheduled group sessions people join on their own, a homepage with three doors, per-player details for group bookings, and the printed QR card's wording | Tonio |

---

## 4. Phase 0: preflight (record all of it in the report)

1. **Revision:**
   - The `origin/master` SHA you will audit (rule 1).
   - Open PRs (`gh pr list --state open`).
   - The conclusion of the last CI run on `master`.
   - Whether the main working tree has uncommitted work. Note it; do not touch it.
2. **Production:** the current production deployment, and whether its commit equals the
   audited SHA.
3. **Access matrix.** Mark each available or unavailable, and how:
   - the GitHub repo, including Actions logs and the security tabs;
   - Vercel, through the CLI or MCP, read-only;
   - Supabase SQL and advisors;
   - Vercel Web Analytics;
   - the Resend dashboard;
   - the Google Cloud OAuth consent screen;
   - the domain registrar and DNS (`nslookup` works without access);
   - Google Search Console;
   - Sentry.

   Everything unavailable feeds "Not checked".
4. **Tests:** can dependencies install in the scratch worktree (rule 5)? If not, the latest
   CI logs are the test evidence, and the report says so.
5. **Baseline metrics.** Aggregates only.
   - **From the database:**
     - Bookings by status and by month, and how many are marked paid (`paid_at`) against how
       many are confirmed.
     - Bookings whose lesson dates have passed but are still `pending`.
     - Students, and how many are flagged `needs_review`.
     - Reviews by source and status, and how many were submitted through the site.
     - Inquiries by month.
     - Rate-limit events in the last 30 days.
   - **From analytics, the last 30 days:**
     - visitors by day, referrer, and device;
     - custom events by name and property;
     - the booking funnel;
     - `tagged_arrival` by source.

---

## 5. Phase 1: inventory and diff

1. Derive from the audited SHA:
   - pages, API routes with their methods, crons, email senders, and short links;
   - signed-link types, analytics events, and environment variable names;
   - database tables, with RLS, policies, constraints, indexes, functions, and triggers, read
     from the live schema;
   - outside services, scripts, workflows, and docs.
2. Compare it with Appendix A. Report every addition, removal, or rename. Anything you cannot
   explain is a finding.
3. Build the **feature inventory**: every feature a student, DeMario, or an admin can use.
   Give each one:
   - who uses it;
   - a status: live and proven by real use in the data, live but unproven, built but not live,
     broken, or unused;
   - and the evidence.

---

## 6. Phase 2: the audit lanes

**Run order: C, D, E, B, then A, F, G, H, I, J.** The first four decide whether students can
book and whether anyone gets hurt.

Read every non-test file under `src/` once. At about 17,000 lines, that is affordable. Each
check is a question to answer, not an assumption to confirm.

### Lane A: offer, positioning, conversion, content, money

- **A1. Who it's for.** On a phone, within five seconds, can each target group tell the site
  is for them? The groups are beginners, competitive adults, and groups who bring their own
  or join one. Quote the copy that does or does not say so.
- **A2. Offer consistency.** Every format must show the same name, length, price, group sizes,
  and court-fee wording everywhere. The formats are Foundations, Strategy Lab, Group Clinic,
  Drilling (60 and 90 minutes), and Play with the Pro.
  - The sources of truth are `src/lib/lesson-types.ts`, `src/lib/session-pricing.ts`, and
    `src/lib/business.ts`.
  - Check them against:
    - the homepage cards;
    - the booking modal quote;
    - the emails, the ICS file, and the calendar links;
    - the terms, JSON-LD, docs, and Admin.
- **A3. Pricing.**
  - Check the per-person and total math for every format and allowed size, including
    rounding.
  - Research current DFW private, group, and clinic prices, with sources and dates.
  - List every place a price increase would have to change, and confirm that existing
    bookings keep their stored quote.
- **A4. Claims ledger.** Find every factual claim on the site:
  - students coached, lessons, podiums, the DUPR rating and rankings;
  - certifications (including the exact wording "USPTA/DUPR certified");
  - school and city roles;
  - the TeachMe.To rating chip.

  For each, give the source, its date, and a status of sourced, stale, or unsourced. Flag
  wording that claims more than the source supports. Cite the FTC's guidance on endorsements
  and advertising substantiation where it applies. Record the testimonials' status as in
  section 3.
- **A5. Third-party names.** Check how TeachMe.To's name, logo, and rating, and the venue
  names, are used, against each party's current terms. Check that the routing to them is
  accurate.
- **A6. Conversion path.**
  - The entry points to booking, and the friction in each modal step: details, court setup,
    terms, the indoor hand-off, and the picker.
  - Read the funnel numbers from Phase 0. Where do people stop?
  - How much traffic does the partner hand-off take?
  - Contact form versus booking: which does the page push?
- **A7. Trust.**
  - Photos: a new hero photo is expected after DeMario's 2026-11-21 tournament.
  - Review display, credentials, and how easy the policies are to find.
  - How the payment instructions read to a cautious first-time student.
  - The promises the site makes about response times.
- **A8. Copy quality.** Spelling, grammar, tone, naming consistency, outdated dates or
  rankings, placeholder text, alt text, and media that does not load.
- **A9. Money.**
  - Decode the payment QR images (`public/img/paypal-qr*.png`) and the Zelle link's payload,
    and compare each with the handles in `src/components/PaymentOptions.tsx`. List every
    handle for DeMario to confirm.
  - Could a payment handle change without review? Check branch protection and code owners.
  - Compare confirmed lessons against `paid_at`. "Mark paid" lives in an Admin he does not
    use: how does he actually know who has paid?
  - How are late-cancel and no-show fees, and refunds, actually collected or paid back?

### Lane B: journeys end to end (student, DeMario, admin)

For each journey, list every step: what the person sees, what the system does, and what can
go wrong. Estimate how many students each failure would plausibly cost. Back each step with
code-path evidence, and a safe live observation where possible (rule 6). Submit steps come
only from code and CI's Playwright run.

- **B1. A new outdoor 1:1 student from Instagram.**
  1. `/ig` keeps the tag through lessons, Book, details, terms, the picker, and Reserve.
  2. The confirmation screen with payment options, then the confirmation email with its ICS
     and calendar link.
  3. DeMario's alert, with "Found you through" and "Add to my calendar". It carries no cancel
     link, because its Reply-To is the student.
  4. Court confirmation by text, then payment with the memo.
  5. DeMario's "Tomorrow" email (with one-tap Cancel), then the student's evening reminder,
     then the lesson.
  6. The outcome email, then "Lesson happened", then the review request, the review, and
     auto-publish.
  7. DeMario's review email with the takedown link, then the homepage update.
  8. "Book your next lesson" (`/book-again`).
- **B2.** An indoor student routed to a partner platform: is the hand-off clear, and is it
  measured?
- **B3.** A "Help me choose" student.
- **B4. Group bookings:** Drilling with 3 players, Play with the Pro, and Group Clinic. Check
  the quote, that the booker pays, who accepts the terms, and that every email and digest
  names the group size.
- **B5.** A contact-form inquiry: the alert to the admin address (reply-to set to the
  student), the daily cap, and the pause notice.
- **B6.** A public-page review: pending, then DeMario's Publish link.
- **B7.** The student wants to cancel or move. What do the emails, the terms, and the reply-to
  route let them do, and what is promised?
- **B8.** DeMario cancels: by text only, in Admin, and with the "Tomorrow" email's one-tap Cancel.
  Include a lesson he also added to his Google Calendar.
  What does the student receive, and what happens to the reminder and the slot?
- **B9.** A no-show; a refund or free reschedule after the coach cancels. Is each supported,
  or manual and undocumented?
- **B10.** A returning student: the student-record match (`src/lib/students.ts`), the
  ambiguity flag, the 90-day review re-ask window, and rebooking.
- **B11. Admin, from code and tests only (rule 4).**
  - Login, MFA, and the sign-in callback (`/auth/callback`).
  - Each tab: bookings, inquiries, availability (time slots, blocks, recurring blocks, the
    weekly template), reviews, tasks, both roadmaps, and Google Calendar status.
  - Feedback and the monitoring test.
  - Which of these are used, and which are dead weight? Use data and code.
- **B12. Failure journeys.**
  - Availability fails.
  - The slot is taken (409), the request is rate limited (429), or the network is down.
  - Email fails after a booking is saved.
  - The database is down.
  - The phone is old, or the user has blocked storage or JavaScript.
- **B13. Assisted journeys.** Book with the keyboard only; with a screen reader through the
  booking modal; at 200% and 400% zoom; and with reduced motion.

### Lane C: booking engine correctness

- **C1. Time.** Dallas time (America/Chicago) everywhere.
  - **DST.** Clocks fall back on 2026-11-01 and spring forward on 2027-03-14. Test every date
    calculation across those dates:
    - availability;
    - "lesson has started";
    - the lesson-date windows of every cron;
    - ICS times, calendar links, and email dates.
  - Watch for the classic bugs:
    - `new Date("YYYY-MM-DD")` parsed as UTC;
    - `toISOString().slice(0, 10)` used as a local date;
    - server-local `setHours` (servers run in UTC);
    - 12 AM/12 PM parsing.
  - **Cron times.** Crons run at fixed UTC times, so their local time moves an hour in winter.
    Check every email or doc that names a local time.
- **C2. Booking window.** Is today excluded? Is the 30-day limit enforced? Check active time
  slots and their ordering. The month endpoint is admin-only: does it agree with the day
  endpoint, including Google busy times?
- **C3. Availability.** It is built from:
  - Google busy ranges, cached 60 seconds per date;
  - non-cancelled bookings, one-off blocks, and recurring blocks;
  - each format's length.

  Overlaps are enforced by an exclusion constraint (23P01) and an exact-slot unique index
  (23505).
  - Hunt for partial overlaps, back-to-back lessons, 90-minute formats near the end of the
    day, and stale past pending bookings.
  - **Configuration that fails open:** what happens when `GOOGLE_CALENDAR_SYNC_ENABLED` is
    anything but `true`, and when Google errors? Is each fail-open or fail-closed choice
    deliberate, and would anyone notice?
  - **Double booking across channels.** Do TeachMe.To, PodPlay, and venue bookings land on the
    calendar that FreeBusy reads? Do site bookings reach that calendar and those platforms?
    Infer the real sync from behavior, and list what DeMario must do by hand.
- **C4. Pricing.** The server recomputes every quote and never takes a price from the browser.
  Check size limits per format, the stored quote columns, and the display strings.
- **C5. State machine.** States are `pending`, `confirmed`, `no_show`, and `cancelled`.
  - For every way a state changes (Admin, outcome links, cancel links), list who
    can make it and when.
  - Check every guard:
    - confirmed only after the lesson starts;
    - a cancellation email only before the lesson starts;
    - outcome links move only `pending` bookings;
    - reactivating a booking runs into the overlap constraint.
  - List what reads each state: review eligibility, reminders, the outcome email, and
    availability.
- **C6. Concurrency and idempotency.**
  - Double submit, and two students racing for one slot.
  - A cron that Vercel starts twice: which crons claim a booking before sending, and which can
    send twice?
  - A double tap on any signed link; retries after a failed email.
- **C7. Input validation.**
  - Names (length, Unicode, greeting rules), emails, and phones (dots, spaces, +1,
    international).
  - Notes (500 characters), the court-setup requirement, the honeypot, and the terms flag.
  - Group size only for group formats; date format and window; time labels that must exist.
  - Status codes and messages that leak nothing internal.
- **C8. Student records.** Phone-first matching, and what happens when phone and email point
  to different students. Source metadata written only when a student is created. The
  backfill script.
- **C9. Data that piles up.**
  - Past pending bookings that drop out of the 3-day outcome window.
  - Review rows whose tokens are never used.
  - Rate-limit rows: is anything pruning them?

### Lane D: messaging (emails, signed links, crons)

- **D1. Email inventory.** For every sender in `src/lib/email/client.ts`, list:
  - its trigger, recipient, subject, from, reply-to, attachments, and links;
  - when it must not send;
  - whether the content matches the current offer and policies.

  Check that:
  - Every value from a person or a form is escaped, including in `href`, `sms:`, and `tel:`.
  - Subjects use short names (they show on lock screens).
  - The student confirmation never echoes free text.
  - Which inbox the admin emails really reach (the first `ADMIN_EMAIL` entry). Is that the
    inbox DeMario reads?
- **D2. Rendering.** Inspect the HTML for Gmail (web and mobile), Apple Mail in light and dark
  mode, and Outlook. Is there a plain-text part or a preheader? Check tap target sizes and
  narrow widths.
- **D3. Deliverability.**
  - Look up SPF, DKIM, and DMARC for the sending domain (`nslookup -type=TXT`), and check
    alignment.
  - Check Resend's domain status, if you have access.
  - How are bounces and complaints handled?
  - Is reply-to correct, and do link domains match the sending domain?
- **D4. Email law.** Classify each email as transactional or commercial under CAN-SPAM's
  primary-purpose test (verify on ftc.gov). Pay attention to the review request and the "Book
  your next lesson" link. List what each commercial or mixed email would need. Is the review
  request sent to every confirmed lesson alike? TCPA applies if text messaging is ever added;
  today it is not.
- **D5. Links that authorize.**
  - Review links (`/review/<token>`) are random, single-use, and do not expire. They are
    stored as hashes salted with `RATE_LIMIT_SALT`, which falls back to the service-role key.
  - Lesson-outcome links and review takedown/publish links are HMAC-signed with
    `LESSON_OUTCOME_SECRET`, each under its own domain prefix. So are cancel links
    (`/cancel-lesson/<token>`).

  For each type, check:
  - expiry and replay behavior;
  - a constant-time comparison;
  - that a GET only renders and only a POST acts;
  - the rate limit, the token-shape check, and `noindex`;
  - that the path is redacted before analytics;
  - the Referrer-Policy, and whether any third-party request leaves a token page.

  Build a **rotation map:** every secret and fallback each link, hash, and cron check depends
  on, and what rotating each one breaks. Note how each cron compares its credential.
- **D6. Crons.** For each route in `vercel.json`, check:
  - the schedule against its intended local time across DST;
  - auth: from code, the answer when the secret is missing; live, an unauthenticated GET must
    answer 401;
  - claim-first or not, the cap per run and deferral logging, and failure status codes;
  - behavior without the Resend key;
  - how anyone learns that yesterday's run failed.

  Read Vercel's current documentation on cron delivery guarantees.
- **D7. Failure paths.**
  - A booking survives an email failure.
  - Where send failures are reported, and whether anyone receives those reports.
  - The inquiry alert cap (20 a day) and its pause notice.

### Lane E: security and privacy (results go only in the private report)

- **E1. Admin auth.**
  - Route by route, prove that every server component that reads data under `/admin`, and
    every admin API route, checks the admin session itself: the allowlist plus MFA at aal2. A
    check in a layout does not count for the pages beneath it. Cite Next.js's authentication
    guide, "Layouts and auth checks".
  - `src/proxy.ts` matches only `/admin`.
  - MFA enrollment cannot be skipped.
  - Public sign-ups are off: as an anonymous caller, read `GET <supabase-url>/auth/v1/settings`
    and check `disable_signup`.
  - Leaked-password protection is on.
  - Count the admin accounts and their MFA factors (aggregates only).
- **E2. Database.**
  - RLS is on for every table. Which policies exist, and is each still needed?
  - The service-role key is used only in server code.
  - What can the anon key do? Reason from the policies; never attempt a write.
  - Read the Supabase security advisors.
- **E3. Abuse of public endpoints.**
  - A rate limit on every public POST, and on GETs that spend quota (availability calls
    Google).
  - Fail-open behavior, IP hashing with a salt, and honeypots.
  - Firewall or WAF rules (read-only), body-size limits, and resistance to enumeration.
- **E4. Injection and encoding.**
  - PostgREST filters built from input (no interpolated `.or()`), and any SQL functions.
  - Email HTML escaping, including `<title>`, and header injection in subjects.
  - `dangerouslySetInnerHTML`, open redirects (`src/lib/safe-redirect.ts`), and server-side
    fetches of user-supplied URLs.
- **E5. Browser security.**
  - CSP, HSTS, frame-ancestors, Referrer-Policy, and Permissions-Policy
    (`src/lib/security-headers.ts`, plus the live response headers).
  - From code: the flags on the admin session cookies, CSRF exposure of cookie-authenticated
    admin APIs, and clickjacking of token pages.
- **E6. Secrets and history.**
  - Env var names by environment.
  - Scan the git history for secrets and for personal data, with a scanner that redacts what
    it finds. Never print a match.
  - Is `.env*` ignored by both git and Vercel? Does any `NEXT_PUBLIC_*` variable hold
    something sensitive?
  - The Google refresh token's storage and scopes. Who holds each credential?
- **E7. Supply chain and repo security.**
  - `npm audit` for production and dev dependencies, and outdated majors.
  - GitHub Actions: pinning (tag or SHA), `permissions`, and no `pull_request_target`.
  - Open CodeQL alerts; the state of Dependabot alerts and security updates; secret scanning
    and push protection.
  - Branch protection or rulesets on `master`, required checks, code owners, and who has write
    access to the repo, Vercel, Supabase, and Resend.
- **E8. Privacy.**
  - **Data inventory:** every piece of personal data collected, where it is stored, who can
    see it, and how long it is kept.
  - **The privacy policy's 2-year retention promise:** is anything enforcing it?
  - **Minimization.**
  - **Personal data in logs** (whole rows passed to `console.error`), in analytics, and in
    URLs sent to Google (calendar links).
  - **Requests to see or delete data:** can DeMario fulfil one?
  - **Browser storage against what `/privacy` and the cookie banner say:**
    - `cookie_consent` (localStorage);
    - `dm_arrival_source` (sessionStorage);
    - `admin-dashboard-tab` (localStorage);
    - the Supabase auth cookies;
    - whatever the analytics script stores.
- **E9. Accounts and domain.**
  - Registrar lock, expiry and auto-renew, and DNSSEC.
  - Two-factor auth on GitHub, Vercel, Supabase, Resend, Google, and the registrar.
  - Whose name each account is in. Ask; do not assume.

### Lane F: data, analytics, observability

- **F1. Schema reproducibility.** Only some tables are created by the SQL in `docs/`. Could
  the database be rebuilt from the repo alone? Diff the live schema against the docs SQL.
- **F2. Data integrity (aggregates).**
  - Bookings without a student.
  - Duplicate students by normalized phone or email.
  - Orphan reviews.
  - Inquiries never read.
  - Whether blocks and recurring blocks are used at all.
- **F3. Retention.** Are rows older than the privacy promise present, and what would delete
  them?
- **F4. Analytics.**
  - Events in the code against `docs/ANALYTICS.md` and `/privacy`.
  - Volume over 30 and 90 days.
  - Can the data answer the two business questions: which channel brings students, and where
    the funnel leaks?
  - Is internal and bot traffic excluded? What does the plan limit?
- **F5. KPIs.** Propose at most five numbers that tell DeMario how the business is doing.
  Say how to read each today, or what is missing to read it.
- **F6. Observability.**
  - Runtime errors and logs for the last 7 to 30 days.
  - Cron run history.
  - Whether Sentry receives events.
  - Health checks and their last runs.
  - Who is told what, and how fast, when something breaks.

### Lane G: platform and operations

- **G1. Vercel.**
  - Plan, Node version, region, and function limits.
  - Env var names by environment.
  - **Previews:** which secrets and which database do preview deployments receive? What
    stops a pull request from a fork, or a preview, from reaching them? Check Git Fork
    Protection, Build Logs and Source Protection, and Deployment Protection.
  - Crons registered as in `vercel.json`, spend management, the Web Analytics plan, domains
    and redirects, and certificates.
- **G2. Supabase.**
  - Plan, region, backups, and point-in-time recovery. Does the plan pause inactive projects?
  - Auth settings, exposed schemas, extensions, advisors, and connection usage.
- **G3. Google OAuth for the calendar.**
  - Is the consent screen's publishing status "Testing"? Google documents 7-day refresh
    tokens for that status; verify the current rule.
  - Minimal scopes, and verification status.
  - Who owns the Google project, and how to reconnect it (`docs/MARIO_ACTION_PLAN.md`).
- **G4. Resend.** Domain verification, plan and quotas against expected volume, bounce and
  complaint webhooks, the API key's scope, and team members.
- **G5. DNS.**
  - A and CNAME records, SPF, DKIM, and DMARC, with the policy DMARC sets.
  - MX: does the domain receive mail, and where do replies go?
  - CAA records.
- **G6. CI/CD.**
  - The gates CI runs, and Node version parity with production.
  - Required checks, and the merge strategy.
  - How a database change is applied and recorded (manual SQL with VERIFY queries).
  - How to roll back a deploy.
  - Is `docs/RELEASE_CHECKLIST.md` current?
- **G7. Backups and recovery.**
  - What is backed up, and where. Has a restore ever been tested?
  - Could env var values be recovered?
  - Is there a runbook for: the site down, the calendar token dead, email failing, a database
    restore, and the domain lapsing?
- **G8. Cost.** Monthly cost per service against revenue from site bookings, and the risk of
  spikes. Are there cheaper options that keep reliability?
- **G9. Continuity.** Who owns each account. Single points of failure. What happens if Tonio
  is unavailable for a month. Can DeMario, or a new developer, run the system from the docs?

### Lane H: code quality, tests, performance, accessibility, SEO

- **H1. Code health.**
  - Server and client boundaries (`HomePage` is a client component).
  - Duplication: the signed-link modules are near copies of each other.
  - Error-handling consistency: does it fail loud, or swallow errors into defaults?
  - Unsafe casts, disabled lint rules, and comments that no longer match the code.
  - Dead code and stale files: unused components and routes, the root `index.html` prototype,
    `FULLSTACK_PROMPT.md`, and `img/` duplicating `public/img/`.
- **H2. Bug patterns.** Grep, then read every hit:
  - `as unknown as`, `any`, and `!.`;
  - `catch {}` or a catch that returns a default;
  - Supabase calls whose `error` is ignored, and `.single()` where `.maybeSingle()` is meant
    (PGRST116);
  - missing `await`, and `after(` without `.catch`;
  - `new Date(` on date-only strings, and `toISOString().slice`;
  - `localStorage` or `sessionStorage` without try/catch;
  - `target="_blank"` without `rel`.

  Review every PR merged since 2026-10-19 with extra care: new code is the least proven.
  Check each spec in `docs/specs/` against the code, both ways.
- **H3. Tests.**
  - CI counts. Coverage of the money paths: booking POST, availability, pricing, state
    changes, crons, emails, and signed links.
  - Pages reached only from email have no e2e.
  - Flaky patterns: tests that leave a server-rendered page before hydration.
  - Mocks whose query-builder behavior differs from the real Supabase client.
  - Assertions that cannot fail.
  - Missing DST, month-end, and leap-day cases.
- **H4. Performance.** Lighthouse on mobile and desktop for `/`, `/review`, `/terms`,
  `/privacy`, and `/pay` (rule 6).
  - What drives LCP; unused JS and CSS; font faces and preloads.
  - Caching and prerender headers.
  - Availability latency from the logs.
- **H5. Accessibility (WCAG 2.2 AA; it is also the bar for ADA exposure).**
  - axe on every public page and every booking-modal state: details, terms, indoor routing,
    picker, error, and confirmed. Also the review form, the token pages, and the admin login.
  - Focus traps, labels, announced errors, contrast, and 44px targets.
  - Reflow at 400%, and reduced motion.
  - The emails: semantics, contrast, and alt text.
- **H6. SEO.**
  - Titles, descriptions, OG images, and JSON-LD validity (pasted, rule 6).
  - Indexable pages have their own canonical; `noindex` pages deliberately have none.
  - Self-hosted reviews are not eligible for Google review stars; verify the current policy.
  - `sitemap.ts` and `robots.ts`.
  - Local search terms, and name, address, and phone consistency across the site and his
    profiles.
  - Search Console data, if granted.

### Lane I: legal, compliance, reputation (flag for professional advice; draw no legal conclusions)

- **I1. Privacy policy truth table.** Test every sentence of `/privacy` against the code and
  live behavior:
  - the fields collected;
  - the Google Calendar statements;
  - cookies and storage (E8);
  - analytics and tagged links;
  - reminders;
  - retention;
  - the 30-day response promise;
  - the vendor claims (check Supabase's current statements).
- **I2. Terms and waiver.**
  - `TERMS_EFFECTIVE_DATE` and `WAIVER_VERSION` against the formats now sold.
  - Group players who never accept the terms.
  - Is the cancellation policy (24 hours free, 50% under 24 hours, full price for a no-show,
    refund or reschedule when the coach cancels) the same in the terms, the emails,
    `docs/ADMIN_HANDOFF.md`, and `docs/MARIO_ACTION_PLAN.md`?
- **I3. The FTC's review and testimonial rule (16 CFR Part 465)** and the Endorsement Guides
  (16 CFR Part 255):
  - suppression;
  - selective solicitation;
  - takedown criteria applied the same way to every review;
  - fake or AI-written reviews;
  - incentives and insider reviews;
  - whether the wording claims the reviews are typical or complete.
- **I4. TeachMe.To's current terms**, cited with their date: branding, students moving
  off-platform, and review solicitation. Check the site, the emails, and
  `docs/ADMIN_HANDOFF.md` against them.
- **I5. Google API Services User Data Policy (Limited Use).** Do the scopes and data handling
  match `/privacy`?
- **I6. Business hygiene.** Ask; do not assume. These are questions for DeMario's accountant
  or lawyer, not conclusions:
  - the business entity and the insurance certificate;
  - business use of Cash App, Zelle, and PayPal: fees, buyer protection, and tax reporting.
- **I7. State privacy law.** Whether the Texas Data Privacy and Security Act or another state
  law applies (note its small-business provisions). Flag it only.
- **I8. Permits and minors.** Paid instruction on public courts may need a city permit. The
  site lists school roles (Dallas ISD), so ask whether minors book or attend, and what that
  implies for the terms and safeguarding. Flag only.

### Lane J: growth and strategy

- **J1. Goal fit.** For every open item and every recommendation, say how it moves "more
  students, then higher prices", within DeMario's real time budget.
- **J2. Channels.** For each channel, give evidence of volume, its cost, how much control he
  has, and the next action:
  - TeachMe.To (fees, terms, dependence);
  - the site;
  - Instagram and TikTok (tagged links);
  - referrals;
  - courts and the QR card;
  - schools and venues;
  - a Google Business Profile (declined for now).
- **J3. Competitors.** A live scan, with sources and dates, of DFW coaches and booking
  platforms. What do they offer that this site does not? Examples: self-serve rescheduling,
  packages, deposits, groups people join on their own, waitlists, and text reminders.
  Separate table stakes from differentiators.
- **J4. Pricing strategy.**
  - The signals that a price can rise: utilization, waitlist, conversion.
  - Revenue per teaching hour by format and group size.
  - Margin from the site against TeachMe.To after its fees (verify the current fee).
  - Package design.
- **J5. Retention and referral.** How to measure the rebook rate today; review velocity;
  referral mechanics.
- **J6. Backlog re-rank.** Rank the parked items and any new ones by evidence. Mark which are
  blocked on DeMario.
- **J7. Experiments.** Three low-cost experiments that fit DeMario's time. Give each a metric,
  a 30-day window, and a stop rule.

---

## 7. Phase 3: live observation (read-only, rule 6)

At 375px and 1280px wide, with Playwright:

1. Walk every public page.
2. Walk the booking modal up to, but not including, Reserve. Include the indoor routing.
3. Walk `/review` up to, but not including, Submit.
4. Open the token pages with an invalid token only (for example
   `/lesson-outcome/not-a-token`). They must say the link is invalid and change nothing.
5. Check the short-link redirects with a HEAD request.
6. Record console errors, CSP violations, failed requests, response headers, and the network
   log's analytics requests (there must be none).

---

## 8. Phase 4: completion check

Fill in the check ledger (report section 16). Every ID from A1 to J7 is passed, a finding, or
not checked with a reason. No ID may be missing.

---

## 9. Phase 5: verification

For every finding, try to prove it wrong:

- Re-read the code path end to end.
- Look for a guard somewhere else: a constraint, the proxy, a caller check.
- Re-run the evidence and record the new output beside the finding.
- Re-check the current primary docs for any vendor or legal claim.

Record a verdict:

- **Confirmed** or **Plausible**;
- **Dropped**, with the reason.

Dropped findings stay in the report so nobody reports them again. An earlier review produced
a false finding because it did not read far enough into a file, so this pass is mandatory.

In parallel mode (section 11), fresh agents do this pass.

---

## 10. The report

Save it to `private/audits/<YYYY-MM-DD>-full-audit.md` in the main working tree.

Before writing, check that the folder is excluded everywhere it must be:

- `git check-ignore -v private/audits/x.md` must show `/private/` from `.gitignore`.
- `.vercelignore` must list `private`.

If either check fails, stop and ask.

Write in plain language. Sections 1 to 3 must make sense to DeMario; technical precision
belongs in the findings.

```markdown
# Full Audit: demariomontezpb.com, <date>

Audited SHA: <sha> · Production deployment: <id> at <sha> · Open PRs: <list>
Access: <matrix from Phase 0>

## 1. Verdict (five lines at most)
## 2. Top 10, ranked (one line each: what, why it matters, fix, effort)
## 3. Scorecard (one row per lane A to J: healthy / at risk / broken / not checked, one line of evidence)
## 4. Findings
   Ledger table: ID | Title | Severity | Verdict | Costs | Owner | Effort | Decision needed
   Then one block per finding, in the format below.
## 5. Feature inventory (feature | user | status | evidence)
## 6. Metrics snapshot (Phase 0 aggregates, and what each means)
## 7. Systems Health Review (format below)
## 8. Decisions needed
   - For DeMario: five at most, in plain language, each with why it matters, the options, and a recommendation
   - For Tonio: settings, accounts, budget, access
## 9. Quick wins (each one hour or less, no decision needed)
## 10. Recommended sequence (this week / next 2 weeks / next 30 days) and Do Not Do Yet
## 11. Not checked, and why
## 12. Regression results (Appendix B, pass or fail each)
## 13. Questions for Tonio and DeMario
## 14. Dropped findings (each with its reason)
## 15. Evidence log (commands, queries, URLs, trimmed outputs, and the docs read, with dates)
## 16. Check ledger (every ID, A1 to J7: status, one line of evidence or the reason not checked)
```

**Each finding:**

```markdown
### F-<lane><n>: <title>
- Severity: P0 / P1 / P2 / P3 · Verdict: Confirmed / Plausible
- Costs: students / revenue / trust / time / legal / security (all that apply)
- Evidence: <file:line, command and output, URL and response, or query and result>
- Re-run (Phase 5): <what was re-run, and the output>
- What happens: <the concrete failure: who, when, what they see>
- Fix: <the smallest change that solves it> · Effort: S (<1h) / M (half day) / L (days)
- Owner: code / Tonio (settings or accounts) / DeMario (decision or action) / vendor
- Decision needed: yes or no (if yes, what)
```

**Severity:**

- **P0:** losing bookings or money now, personal data exposed, active legal exposure, or a
  core flow broken. Fix today.
- **P1:** likely to cause loss or harm within weeks, or blocks the stated goal. Fix this week.
- **P2:** degrades experience, trust, or maintainability. Queue it.
- **P3:** polish and hygiene.

**Systems Health Review** (Tonio's format; the ten lenses):

```markdown
## Summary
## Weakest Systems   (repeat per weak area, ranked)
- System:
- Evidence:
- Why it matters:
- Smallest useful fix:
- Fix now / queue / ignore:
## System Map
- Intake:          (forms, APIs, links: typing, validation, trust)
- Digestion:       (normalization, rejection of messy input)
- Circulation:     (data moving between browser, server, database, email, people)
- Brain:           (pricing, availability, state rules, routing)
- Nervous System:  (logs, analytics, errors, alerts, who is told)
- Immune System:   (auth, RLS, secrets, rate limits, privacy, compliance, dependencies)
- Muscle:          (can a student book, and can DeMario run his day, simply and reliably)
- Memory:          (records, docs, decisions, retention, handoff)
- Recovery:        (retries, tests, rollbacks, backups, manual overrides, runbooks)
- Homeostasis:     (the steady state: limits, rhythms, metrics, quality gates)
## Recommended Sequence
## Do Not Do Yet
## Handoff Notes
```

**A calibration example** (from the 2026-10-19 audit, since fixed):

```markdown
### F-H7: Keyboard focus escapes the booking dialog
- Severity: P1 · Verdict: Confirmed
- Costs: students / legal
- Evidence: Playwright on the live site: 32 of 40 Tab presses from inside the open booking dialog landed on page elements behind it
- Re-run (Phase 5): same script, same result
- What happens: a keyboard or screen-reader user loses their place mid-booking and may not finish
- Fix: trap focus in both directions while the dialog is open; return focus to the opener on close · Effort: S
- Owner: code · Decision needed: no
```

**Close in the chat** with 15 lines or fewer: the verdict, the top five, counts by severity,
the number of checks not run, and the report path. Do not paste the report.

---

## 11. Running it in parallel (only if Tonio asks for it)

The lanes are independent, so they can run as separate agents. Each agent gets sections 0 to
3, its lane, the finding format, and `private/AUDIT_ENV_NOTES.md` if it exists.

1. Run Phase 0 and Phase 1 once, first, and share their output.
2. Group the lanes: C, D, E, B, A+J, F+G, H, I.
3. Then fresh agents run the Phase 5 verification, then the synthesis.

Parallel agents cost many times more than one session. Use them only on Tonio's explicit
request.

---

## Appendix A: reference inventory (as of 2026-10-24, `master` after PRs #38 to #43)

Any difference from this list at the audited SHA is itself a finding to explain.

- **Pages:**
  - Public: `/`, `/pay`, `/privacy`, `/terms`, `/review`, `/review/[token]`
  - Token pages: `/lesson-outcome/[token]`, `/review-action/[token]`, `/cancel-lesson/[token]`
  - Admin: `/admin/login`, `/admin/mfa-setup`, and under `/admin/(protected)`: the dashboard,
    `reviews`, `roadmap`, `site-roadmap`, `tasks`
  - Generated: `robots.ts`, `sitemap.ts`, `not-found.tsx`, `global-error.tsx`
- **Short links** (redirects in `next.config.ts`, from `src/lib/arrival-source.ts`): `/ig`,
  `/tiktok`, `/card`, `/book-again`.
- **Routes:**
  - Public API: `availability` GET, `bookings` POST, `inquiries` POST, `reviews` POST,
    `reviews/published` GET, `time-slots` GET, `lesson-outcome` POST, `review-action` POST,
    `cancel-lesson` POST.
  - Auth: `/auth/callback` GET.
  - Admin API:
    - `availability/month` GET, `bookings` GET, `bookings/[id]` PATCH, `blocked-slots`
      GET/POST, `blocked-slots/[id]` DELETE;
    - `recurring-blocks` GET/POST, `recurring-blocks/[id]` DELETE, `time-slots` POST,
      `time-slots/[id]` PATCH/DELETE;
    - `inquiries/[id]` PATCH, `reviews` GET, `reviews/[id]` PATCH/DELETE, `roadmap/[key]`
      PATCH;
    - `tasks` GET/POST, `tasks/[id]` PATCH/DELETE, `calendar-sync` GET, `feedback` POST,
      `monitoring-test` POST.
  - Cron: `cron/lesson-outcomes`, `cron/coach-tomorrow`, `cron/lesson-reminders`, and
    `cron/review-requests`. Read the schedules from `vercel.json`.
- **Email senders** (`src/lib/email/client.ts`):
  - To students: `sendBookingCreatedEmails` (which also alerts the admin address),
    `sendBookingCancelledEmail`, `sendReviewRequestEmail`, `sendLessonReminderEmail`.
  - To the first `ADMIN_EMAIL` address: `sendInquiryNotificationEmail`,
    `sendInquiryAlertsPausedEmail`, `sendReviewNotificationEmail`, `sendLessonOutcomeDigest`,
    `sendCoachTomorrowEmail`, `sendFeedbackEmail`.
- **Tables** (all with RLS on): `admin_tasks`, `blocked_slots`, `bookings`, `inquiries`,
  `rate_limit_events`, `recurring_blocks`, `reviews`, `roadmap_checks`, `students`,
  `time_slots`. Policies exist only on `blocked_slots`, `recurring_blocks`, and `time_slots`
  (one select each).
- **Environment variable names:**
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `SUPABASE_SERVICE_ROLE_KEY`.
  - Site: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_LESSON_LOCATION`,
    `NEXT_PUBLIC_GOOGLE_REVIEW_URL`.
  - Email: `ADMIN_EMAIL`, `EMAIL_FROM`, `RESEND_API_KEY`.
  - Crons, links, and hashing: `CRON_SECRET`, `LESSON_OUTCOME_SECRET`, `RATE_LIMIT_SALT`.
  - Google Calendar: `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_SYNC_ENABLED`,
    `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`.
  - Sentry: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
    `SENTRY_AUTH_TOKEN`.
  - Analytics: `VERCEL_WEB_ANALYTICS_ENDPOINT`.
- **Analytics events:** `book_cta_click`, `booking_step_viewed`, `booking_failed`,
  `booking_created` (sent from the server), `venue_link_click`, `contact_click`,
  `payment_link_click`, `inquiry_submit`, `review_submit`, `outbound_click`,
  `tagged_arrival`.
- **Outside services:**
  - Infrastructure: Vercel (hosting, crons, analytics), Supabase, Resend, Google Calendar,
    Sentry, GitHub (CI and CodeQL).
  - Linked partners: TeachMe.To, and the venues in `src/lib/venue-rules.ts`.
  - Payments: Cash App, Zelle, PayPal.
  - Social: Instagram, TikTok, Facebook.
- **Workflows:** `.github/workflows/ci.yml` (typecheck, lint, unit, build, e2e) and
  `.github/workflows/site-health.yml` (an hourly read-only check of the live site).
- **Marketing files:** `docs/marketing/` (the QR code for `/card`).

## Appendix B: regression checks (fixed before; each must still hold)

1. Public sign-ups are off (`disable_signup` is true for an anonymous caller).
2. RLS:
   - Only the three intended select policies exist.
   - Every other table has no anon or authenticated access.
3. The CSP is present, with no violations on any page. HSTS includes subdomains.
4. Fonts are self-hosted, and the preloads match files that exist.
5. Email:
   - Every interpolated value is escaped, including `<title>`.
   - The student confirmation never echoes typed free text.
   - The greeting uses a plain first name only.
6. Booking dialog:
   - Focus stays trapped in both directions; the sticky nav sticks.
   - The cookie notice covers no controls.
   - There is one `<main>` landmark, and tap targets are 44px or larger.
7. Indexable pages have their own canonical. `/pay` and every token page are `noindex`, with
   no canonical.
8. Availability answers 400 for today and for dates beyond 30 days. Google busy times are
   cached per date for about a minute.
9. Booking modal:
   - Dates across DST are converted correctly, and the February date strip is right.
   - Dotted phone numbers are accepted, and day chips show the month.
   - The day list refreshes at midnight, and a stale availability answer is ignored.
   - The time list can be retried.
10. "Lesson happened" works only after the lesson starts. Cancelling a lesson that has started
    emails no one.
11. The review-request and reminder crons claim each booking before sending.
12. The rate limiter records before counting. The admin sign-in redirect accepts only local
    paths.
13. The CI token is read-only.
14. Analytics:
    - Event properties are closed sets.
    - Every emailed-link page live at the audited SHA has its token redacted.
    - The server event posts to the production domain.
15. The short links answer 307 with the right source. `/book-again` opens the booking form
    once, and a refresh does not reopen it.
16. Each inquiry emails the admin address, up to the daily cap; after that, one pause notice
    goes out.
17. Group quotes are priced on the server from the table, and the booker pays the total.
18. Every page and layout under `app/admin/(protected)` checks the admin session before it
    reads data, and `src/app/admin/protected-pages.test.ts` enforces it.
19. The new-booking email carries no cancel link (its Reply-To is the student). One-tap Cancel
    appears only in the "Tomorrow" email, and it refuses a lesson that has started or whose
    time cannot be read.

## Appendix C: environment notes

Machine-specific notes (tool quirks, account details, analytics query commands) live in
`private/AUDIT_ENV_NOTES.md` on Tonio's machine. That file is gitignored. Read it if it
exists. If it does not, ask Tonio for access details rather than guessing.
