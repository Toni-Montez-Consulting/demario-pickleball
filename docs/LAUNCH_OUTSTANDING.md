# Public Launch Outstanding Notes

Last updated: 2026-08-12. Previous revision was 2026-05-06 and had gone stale: it
still listed database work that shipped in round 1 (2026-07-28) and in the
double-booking fixes (2026-08-02).

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

Not verifiable by query, so still worth a functional check at some point:
anonymous read/write blocking on `bookings`, `inquiries`, and `rate_limit_events`
(the policies are in place, but proving it needs a real anon-key request).

## Genuinely Open

### The review loop has never run in production

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

Owner: Mario for confirming bookings, Tonio for watching the first live pass.

### Live booking QA

Never completed. Submit one real test booking with phone, preferred court setup,
and preferred area/court. Confirm the student email, admin email, calendar
invite, Google Calendar link, payment links, QR code, and admin booking row all
show the expected details. Cancel it from admin and confirm the cancellation
email arrives. Confirm a busy Google Calendar event blocks a public slot.

Owner: Tonio and Mario.

### Production Google Calendar refresh token

Still outstanding. Generate a fresh token with Mario and confirm
Admin -> Availability reports Google Calendar connected.

Note: environment variables added through the Vercel CLI are stored as sensitive
and cannot be read back. "Set" is verifiable; "set to the right value" is not.
Check this functionally in the admin diagnostic, not by pulling env.

Owner: Tonio.

### First real review, end to end

Submit one review through the emailed link and publish it from Admin -> Reviews.
Blocked behind the review loop above.

Owner: Tonio and Mario.

### CRON_SECRET

`vercel.json` declares the daily cron at 15:00 UTC. The route returns a 500 and
logs loudly if `CRON_SECRET` is missing, so this is verifiable from the function
logs once a lesson is eligible. Confirm the cron appears in the project's Cron
Jobs tab.

Owner: Tonio.

## Blocked On Mario

- Pricing, duration, and player counts for drilling sessions and
  play-with-the-pro. This blocks all of round 2.
- The source of the live `5.0 star, 79 reviews` claim. Unverified since May. If
  the source or permission is not ready, replace the claim with softer copy.
  Acceptable proof: Google Business Profile, TeachMe.To profile, another public
  review source, or direct written permission.
- Mario has no Google Business Profile. Verify service-area-business eligibility
  against live Google documentation before writing that task.
- DUPR read-only API or partner access. Automated rating sync waits on it.

The three homepage testimonials are confirmed real and permissioned.

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
- `Cancel` marks the booking cancelled and sends the cancellation email.
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
  Tonio accept that risk.
- Add structured venue selection only after the court expansion checklist proves
  it will help students more than it clutters booking.
- Add a short availability debounce or cache if public traffic increases.
- Replace static review claims with linked review-source badges when Mario's
  review profiles are ready.
