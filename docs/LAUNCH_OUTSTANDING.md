# Public Launch Outstanding Notes

Last updated: 2026-10-19, after the October round (PRs #12 to #21) and that
evening's production checks. The full reconciliation below is from 2026-08-12. The revision before that (2026-05-06)
had gone stale: it still listed database work that shipped in round 1
(2026-07-28) and in the double-booking fixes (2026-08-02).

This file captures the items that code cannot prove on its own. Anything listed
here as verified was checked against production on the date shown, not inferred
from a merged pull request.

## Verified Done (2026-08-12, queried against production Supabase)

These were open in the May revision and are now confirmed present in the live
database. Do not re-run the migrations; they are applied.

- `bookings_unique_active_slot` partial unique index exists.
- `bookings_no_overlap` exclusion constraint exists, so a 90-minute clinic can no
  longer sit on top of a 60-minute lesson an hour later.
- `admin_tasks.priority` exists.
- The `students`, `reviews`, and `rate_limit_events` tables exist.
- The student backfill ran: 5 bookings, 3 students, 0 unmatched.
- 15 active time slots are configured.

## Verified 2026-10-19 (checked against production)

### Anonymous access is blocked

Checked with real anon-key requests, the same key the site ships to browsers.
Reads of `bookings`, `inquiries`, `rate_limit_events`, `students`, `reviews`,
`admin_tasks`, and `roadmap_checks` returned 0 rows, while `bookings` holds 8.
Inserts into `bookings`, `inquiries`, and `rate_limit_events` were rejected by
RLS (code 42501). Each insert left a required column empty, so even a missing
policy could not have saved a row.

### Google Calendar blocking works

No new refresh token is needed. Public availability for October 20, 21, and 23
marked times unavailable that can only come from Mario's Google Calendar: those
days have no bookings, blocked slots, or recurring blocks. The token was last
set on 2026-04-28. Google expires tokens from apps in Testing mode after 7 days,
so this one is not on that clock.

If public availability ever returns a 500, check the token first. A calendar
error makes the booking picker show no times at all; it does not fall back to
ignoring the calendar.

Environment variables added through the Vercel CLI are stored as sensitive and
cannot be read back. "Set" is verifiable; "set to the right value" is not, so
check this functionally, as above, not by pulling env.

### CRON_SECRET and both crons

An unauthenticated request to either cron route returns 401 in production, and
a route returns 500 instead when the secret is missing. `vercel crons ls` lists
both: the lesson outcome digest at 13:00 UTC and review requests at 15:00 UTC.

### Sign-ups off, and signed-in sessions locked down (2026-10-20)

The evening checks found public sign-ups on in Supabase Auth. Every policy for
signed-in sessions was also `using (true)`. Together, anyone could register and
then read or change bookings and inquiries through Supabase's API. No one had:
the only 5 accounts were the listed admins, all with MFA. Both were closed at
00:32 to 00:33 UTC, after Tonio's go-ahead:

- Sign-ups are off. `supabase config push` ran from a config declaring only
  `[auth] enable_signup = false`, and `config diff` showed that single change
  first. Supabase's public auth settings now report `disable_signup: true`, with
  email login still on.
- The nine signed-in-session policies are dropped
  (`docs/supabase-service-role-only-migration.sql`). Only the three "Public
  select" policies remain. A simulated signed-in session sees 0 rows in
  `bookings`, `inquiries`, `admin_tasks`, `roadmap_checks`, and `students`.
- The site is unaffected. Admin reads and writes through the service role. The
  public lesson-times endpoint still returns all 15 slots, and anonymous reads
  and writes are still blocked.

## Genuinely Open

### The review loop in production

This is the important one. Round 1 shipped the student spine and the review loop
on 2026-07-28, and as of 2026-08-12 it has produced nothing:

- `review_request_sent_at` is null on all 5 bookings. Zero review requests have
  ever been emailed.
- All 7 rows in `reviews` are `source = 'legacy'` seeds from 2026-07-26. Zero
  student-submitted reviews.
- Zero new bookings since 2026-07-28.

This is not a code defect. The daily cron only asks for a review on a booking
with status `confirmed` that is at least 24 hours past the lesson date, inside a
30-day lookback. The only lesson in that window (2026-07-25) is still `pending`,
because nobody confirmed it in Admin. The loop is waiting on real traffic and on
Mario using the Confirm action, not on more code.

Until a real lesson runs through it, treat the review loop as built and unit
tested but unproven in production.

**Update 2026-10-19.** Still unproven. Aggregate counts on 2026-10-18: 8
bookings, 1 ever confirmed, 0 review requests sent. PR #18 adds a morning email
that gives Mario one-tap Lesson happened / No-show / Didn't happen links for
recent pending lessons, so they get recorded without opening Admin.
`LESSON_OUTCOME_SECRET` was set in Vercel Production later on 2026-10-19, so it
is on. The test with a test booking is still open; see the Lesson Outcome Nudge
section of `docs/RELEASE_CHECKLIST.md`.

**Update 2026-10-20: the loop ran for the first time.** At 10:41 UTC, on Mario's
word, the October 19, July 25, and August 26 lessons were recorded as happened,
and May 22 as didn't happen. The 15:00 UTC cron then sent the first review
request ever, for the October 19 lesson. That booking is stamped at 15:00 UTC,
which the cron does only after Resend accepts the email, and its review row is
waiting, not yet submitted. The July 25 and August 26 students were not asked:
those lessons are outside the cron's 30-day lookback. Counts read early
on 2026-10-21 UTC: 8 bookings (4 confirmed, 3 cancelled, 1 pending) and 1
review request sent. Still unproven: a student submitting a review through the
link.

Owner: Mario for confirming bookings, Tonio for watching the first live pass.

### Live booking QA

Never completed. Submit one real test booking with phone, preferred court setup,
and preferred area/court. Confirm the student email, admin email, calendar
invite, Google Calendar link, payment links, QR code, and admin booking row all
show the expected details. Cancel it from admin and confirm the cancellation
email arrives. Confirm a busy Google Calendar event blocks a public slot.

Once round 2 is live, add one booking each for a 60-minute and a 90-minute
Drilling Session and for Play with the Pro, each with more than one player.
Check that the group size and the total show in both emails, the invite, the
Admin row, and the next morning's digest.

Owner: Tonio and Mario.

### First real review, end to end

Submit one review through the emailed link and publish it from Admin -> Reviews.
The first link went out on 2026-10-20. Waiting on that student to submit, then
on Mario to publish it.

Owner: Tonio and Mario.

## Blocked On Mario

- DUPR read-only API or partner access. Automated rating sync waits on it.

Answered 2026-10-20: Mario sent pricing, durations, and group sizes for drilling
sessions and Play with the Pro, so round 2 is no longer blocked on him. He does
not want a Google Business Profile for now. He also kept the Group Clinic as it
is and approved the two new cards' text.

The three homepage testimonials are confirmed real and permissioned.

The unsourced `5.0 star, 79 reviews` claim was removed on 2026-07-26
(`dad3a06`). Since #13 (2026-10-19) the trust strip links his TeachMe.To rating
instead: 5.0 from 137+ ratings, checked October 2026.

## Settled

### Venue and platform routing

The launch workflow is reflected in `docs/VENUE_RULES.md` and on the site: public
outdoor courts schedule through `demariomontezpb.com`; Dallas Indoor and The
Grove route to PodPlay; Life Time routes through Life Time; TeachMe.To stays on
TeachMe.To; Samuel-Grand uses Impact Activities for the court reservation before
coaching-fee coordination. Use the court expansion checklist before adding any
new venue.

### Insurance, waiver, and policy proof

Treated as sorted for launch. Keep the active insurance certificate and the
reviewed wording on file outside the repo. Send Tonio any future wording changes
before site copy changes.

Owner: Mario.

## Operational Facts

### Google Calendar FreeBusy

The site does not poll Google Calendar in the background. It checks FreeBusy on
demand when availability loads and again when a student submits a booking. That
keeps availability fresh enough for launch and avoids storing calendar event
details.

If traffic grows, consider a very short server-side cache or a client-side
debounce. The final booking submit should still check Google Calendar before
inserting a booking.

### Group sessions (round 2)

Drilling Sessions (`drill_60`, `drill_90`) and Play with the Pro (`play_pro`) book
with a group size. The server prices them from `src/lib/session-pricing.ts` and
stores the quote on the booking: `group_size`, `quoted_per_person_cents`, and
`quoted_total_cents`. The person booking pays the group total. Play with the Pro
holds one hour; DeMario extends a longer session on his own calendar. The
database change (`docs/supabase-round-2-sessions-migration.sql`) was applied on
2026-10-21 at 01:49 UTC, before PR #29 merged. Spec:
`docs/specs/2026-10-20-drilling-and-play-with-the-pro.md`.

### Booking overlap protection

Three layers, and they do not cover the same ground:

1. `bookings_no_overlap` in the database catches any lesson that overlaps another
   booking, including a manual insert or a race.
2. `src/lib/availability.ts` expands bookings, blocked slots, and recurring
   blocks into intervals so overlapping times never render as bookable.
3. Google Calendar FreeBusy blocks times Mario is busy elsewhere.

The database constraint only sees the `bookings` table. Blocked slots and
recurring blocks are guarded by the application layer alone.

### Admin booking actions

- `Confirm` marks the booking confirmed. It does not email the student. It is
  also what makes a booking eligible for a review request 24 hours after the
  lesson.
- `Cancel` marks the booking cancelled and emails the student a cancellation.
  Once the lesson has started, the button reads `Didn't happen` instead and
  emails no one (#18).
- The `Needs outcome` filter lists pending bookings whose lesson date has
  passed (#18).
- `Mark paid` toggles `paid_at` after Mario receives Cash App, Zelle, or PayPal.
- Mario should text each new student to confirm the exact court, any court
  reservation fee, and payment expectation.

### Payment and court fees

The booking confirmation and payment cards show the lesson fee. Any indoor or
reserved court fee is confirmed separately by Mario before the lesson.

## Good Post-Launch Improvements

- Configure Sentry or another production monitoring tool, then verify a test
  event from `POST /api/monitoring-test` while logged in as an MFA-verified
  admin. Recommended for long-term operations, not a launch blocker if Mario and
  Tonio accept that risk. Production has no Sentry DSN as of 2026-10-19, so the
  email-failure reports added in #15 go nowhere yet: a failed booking or lead
  email shows only in Vercel's runtime logs, and nothing alerts anyone.
- Add structured venue selection only after the court expansion checklist proves
  it will help students more than it clutters booking.
- Add a short availability debounce or cache if public traffic increases.
- Link more review sources as Mario's profiles are ready. TeachMe.To is linked
  (#13); Google reviews wait on a Business Profile.

### Backlog from the 2026-10-23 growth session

Parked by Tonio on 2026-10-23 ("We can backlog those pages"). The goal is more students, then
higher prices. DeMario wants more groups, adult and older-adult beginners, and competitive
adults who do not want to go pro.

- **Scheduled group sessions people join on their own** (for example "Saturday 9 AM drilling,
  3 of 8 spots left"), alongside bring-your-own groups. Both are wanted. Mario decides first:
  1. The minimum number of players to run a session, and when it is called off.
  2. The price: a fixed price per player, or one that drops as more join.
  3. Whether each player pays for their own spot (bring-your-own groups stay booker-pays).
  4. How he posts a session from his phone in about a minute.
  5. The levels offered.
- **Homepage with three clear doors:** new to pickleball, already play and want to get better,
  and bring or join a group. The copy needs Mario's approval.
- **Per-player details for group bookings:** each player's name and email, and each one
  accepting the coaching terms. Waits on the open waiver question in decision 4 of
  `docs/specs/2026-10-20-drilling-and-play-with-the-pro.md`.
- **QR card design:** `/card` is live with the tagged links; the printed card's wording needs
  Mario's approval.
