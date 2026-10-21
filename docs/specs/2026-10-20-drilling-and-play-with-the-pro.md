# Drilling Sessions and Play with the Pro

**Status:** built in PR #29, 2026-10-20. Every decision in section 6 is made. The database
migration was applied to production on 2026-10-21 at 01:49 UTC, before the PR merged
(section 7). The source is DeMario's texts to Tonio on 2026-10-20; his numbers win over
anything here.

## 1. What DeMario asked for

- **Drilling sessions** bookable on the site. Players choose 60 or 90 minutes and a group of 1
  to 8. The site shows the price per person and calculates the total. Court fees, if any, are
  separate from the coaching price.
- **Play with the Pro** bookable on the site. He already runs these for a few clients. A
  session lasts one to two hours, flexible by group, at the same price either way, for 1 to 4
  players. The site shows the price per person. Court reservation fees are separate from the
  coaching price.

## 2. Pricing, per person

| Players | Drilling 60 min | Drilling 90 min | Play with the Pro |
|---|---|---|---|
| 1 | $60 | $80 | $70 |
| 2 | $30 | $40 | $40 ($80 total) |
| 3 | $25 | $35 | $35 ($105 total) |
| 4 | $20 | $30 | $30 ($120 total) |
| 5 | $18 | $25 | — |
| 6 | $15 | $22 | — |
| 7 | $15 | $20 | — |
| 8 | $15 | $18 | — |

These live in `src/lib/session-pricing.ts`, with a unit test on every cell.

## 3. What existed before round 2

- Three lesson types, in `src/lib/data.ts` and `src/lib/business.ts`:
  - Foundations: 60 minutes, $70.
  - Strategy Lab: 75 minutes, $80.
  - Group Clinic: 90 minutes, 3 to 4 players, $50 per player. One person books and tells
    DeMario who else is coming.
- Lesson length is set in two places: `LESSON_DURATION_MINUTES` in code, and
  `booking_duration(lesson_type)` in the database. The second feeds the `bookings_no_overlap`
  exclusion constraint. A CHECK constraint allowed only the three lesson types.
- The lesson names were copied into seven files, and the prices into four.
- Payment is offline: Cash App, Zelle, and PayPal links on the confirmation and on `/pay`.
- Venue routing applies to every format. Public courts book on the site; indoor venues route
  to their platforms (`docs/VENUE_RULES.md`).

## 4. Design as built

### The session quote (Interface Code Contract)

**Anatomy.** The booking form gains two controls after the format choice:

- A length switch, `60 min | 90 min`, for drilling only.
- A group-size stepper, `− 3 players +`, limited per format.

A quote line sits beneath them: "$25 per person · 3 players · $75 total". Under it, the note:
"Court fees, if any, are separate. DeMario confirms them with you." The existing date and time
picker, details, and terms steps follow unchanged.

**States.**

- The group size starts at 1, and the stepper disables at each limit.
- The quote updates on every change, and an invalid combination cannot be submitted.
- Switching formats clamps the group size into the new range.

**Mobile.** Stepper and length buttons are at least 44px. At 320px the quote line fits the
dialog without sideways scrolling. The five lesson tabs wrap onto a second row on a phone.

**Banned defaults.**

- A dropdown of price rows.
- A total revealed only on a later step.
- Prices written into copy instead of read from the table.

**Analytics.** `booking_created` carries the stored lesson type (`drill_60`, `drill_90`,
`play_pro`), and `book_cta_click` the card's format (`drill`, `play_pro`). Both are closed sets.
Group size is not sent: Vercel's Pro plan keeps two properties per event, and
`booking_created` already uses both. Every booking's group size is in the database.

### Data

- **New `lesson_type` values:** `drill_60`, `drill_90`, and `play_pro`. Encoding the length in
  the type keeps `booking_duration(lesson_type)`, and with it the exclusion constraint, working
  unchanged.
- **New `bookings` columns, all nullable:** `group_size smallint`, `quoted_per_person_cents
  integer`, and `quoted_total_cents integer`. They are stored at booking time, so a later price
  change does not rewrite history.
  - Group formats must have all three, with the total equal to per person times players, and
    a size inside the format's limits. Every other lesson has none. The database enforces this
    in `bookings_group_quote_check`.
  - The draft said `group_size not null default 1`. That would have recorded a made-up 1 for
    every clinic booking, whose group size the site never collects.
- **Migration:** `docs/supabase-round-2-sessions-migration.sql`, one transaction:
  1. Extend the `lesson_type` CHECK.
  2. Give `booking_duration` all six types: 60, 75, 90, 60, 90, and 60 minutes.
  3. Rebuild `bookings_no_overlap` on the new function.
  4. Add the columns and their CHECK, then reload the PostgREST schema cache.

  Existing rows keep their durations. `src/lib/lesson-types.test.ts` reads the file and fails
  if its types, durations, or size limits stop matching the code.

### Server

- `POST /api/bookings` accepts `lesson_type` and `group_size`. It quotes from
  `src/lib/session-pricing.ts` and stores the quote. It answers 400 for an unknown type, a
  missing or out-of-range size, or a size sent with a lesson that is not a group format. A
  price sent by the browser is never read.
- Availability blocks each type's duration through the existing interval logic.
- One module, `src/lib/lesson-types.ts`, now names every type and holds the fixed fees. The
  seven copied name lists are gone.

### Everywhere a booking appears

- **Booking form:** the quote line, the time picker's summary, the confirmation, and the
  payment amount. The person booking sees the group's total as the fee due.
- **Student email:** a Players row, and the group total as the lesson fee.
- **Admin email:** Players, and what the booker pays.
- **Calendar invite and Google Calendar link:** a Price line. A 90-minute drilling session runs
  90 minutes; Play with the Pro holds one hour.
- **Admin booking row:** the quote line under the format.
- **Morning digest and the outcome page:** the group size.
- **Review request and review page:** the format name only. The draft listed price here too,
  but a price has no place in a request for a review.
- **Terms:** the services and price lists include both formats. See decision 4.

## 5. Built (PR #29)

- `src/lib/session-pricing.ts`: DeMario's table, `quoteSession()`, and the shared price
  wording.
- `src/lib/lesson-types.ts`: the six stored types, their names, the fixed fees, the group
  quotes, and the stored-quote helpers.
- The lesson cards (`src/lib/data.ts`, `src/components/Lessons.tsx`): two new cards with
  DeMario's approved text and a price table each in place of a timeline.
- The booking form (`src/components/BookingModal.tsx`), the bookings API, and every surface in
  section 4.
- Tests: every price, the price wording against DeMario's approved lines, code and database
  parity, booking validation, the form's quote and limits, emails, the invite, availability,
  the digest, Admin, and two Playwright tests (both formats end to end, and a 320px phone).

## 6. Decisions

1. **Keep the Group Clinic as it is (DeMario, 2026-10-20).** It stays $50 per player, 90
   minutes, 3 to 4 players, alongside the new formats. He said it gives people more options
   and he does not mind it sitting next to them.
2. **Play with the Pro blocks 1 hour (Tonio, 2026-10-20).** A student choosing the length would
   always pick 2 hours, since the price is the same. When a group plays longer, DeMario extends
   the event on his Google Calendar or blocks the time in Admin. The site's calendar check then
   keeps that time from being booked.
3. **The person who books pays the group total (Tonio, 2026-10-20).** The booking
   confirmation and the student email show the total. `/pay` lists the payment methods without
   a booking, so it shows no amount.
4. **Launch on the clinic's waiver precedent (Tonio, 2026-10-20).** Only the person booking
   accepts the coaching terms. The wider gap for groups of up to 8 joins the open waiver-version
   question for whoever advises on the waiver. Two more points join it:
   - The terms now list both formats and their prices, but the effective date (April 23, 2026)
     and `WAIVER_VERSION` (2026-04-24) are unchanged.
   - The cancellation terms charge a share of "the lesson price". For a group, that reads as
     the group's total.
5. **DeMario approved the descriptions as drafted (2026-10-20).** The card text is in
   `src/lib/data.ts`. The price lines are built from the table, and a test checks them against
   the approved wording: "$60 solo, from $15 per player." and "$70 solo, from $30 per player."

## 7. Release order and verification

1. CI green on PR #29: unit tests, the build, and Playwright.
2. Preview check in a real browser: the cards, and the form's quote on a phone and a desktop.
   No booking is submitted, because previews use the production database.
3. With Tonio's go-ahead, apply the migration, then run its VERIFY queries. Done on
   2026-10-21 at 01:49 UTC; every VERIFY query matched.
4. Merge. Production deploys from Git; check it the same way as the preview.
5. After deploy, one real booking per format with DeMario, folded into the live booking QA in
   `docs/LAUNCH_OUTSTANDING.md`.

Before step 3, the new formats cannot be booked anywhere: the database refuses their types.
The three original lessons work either way, because their inserts never name the new columns.

## 8. Not in scope

- Packages and lesson credits: not yet priced.
- Stripe.
- Collecting every player's name or waiver: decision 4 keeps one waiver per booking for now.
- Recurring group sessions.
