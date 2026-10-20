# Drilling Sessions and Play with the Pro

**Status:** draft, 2026-10-20. Pricing is settled. Section 6 holds the decisions for Tonio
before the booking flow is built. The source is DeMario's texts to Tonio on 2026-10-20; his
numbers win over anything here.

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

## 3. What exists today

- Three lesson types, in `src/lib/data.ts` and `src/lib/business.ts`:
  - Foundations: 60 minutes, $70.
  - Strategy Lab: 75 minutes, $80.
  - Group Clinic: 90 minutes, 3 to 4 players, $50 per player. One person books and tells
    DeMario who else is coming.
- Lesson length is set in two places: `LESSON_DURATION_MINUTES` in code, and
  `booking_duration(lesson_type)` in the database. The second feeds the `bookings_no_overlap`
  exclusion constraint. A CHECK constraint allows only the three current lesson types.
- Payment is offline: Cash App, Zelle, and PayPal links on the confirmation and on `/pay`.
- Venue routing applies to every format. Public courts book on the site; indoor venues route
  to their platforms (`docs/VENUE_RULES.md`).

## 4. Proposed design

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

**Mobile.** Stepper buttons are at least 44px. At 320px the quote line stays visible above the
continue button.

**Banned defaults.**
- A dropdown of price rows.
- A total revealed only on a later step.
- Prices written into copy instead of read from the table.

**Analytics.** Booking funnel events carry a format code and a group-size bucket, both from a
closed set and never anything the student typed (as `docs/ANALYTICS.md` requires).

### Data

- **New `lesson_type` values:** `drill_60`, `drill_90`, and `play_pro`. Encoding the length in
  the type keeps `booking_duration(lesson_type)`, and with it the exclusion constraint, working
  unchanged.
- **New `bookings` columns:**
  - `group_size smallint not null default 1`, checked 1 to 8.
  - `quoted_per_person_cents` and `quoted_total_cents`, stored at booking time so a later price
    change does not rewrite history.
- **Migration**, applied only with Tonio's go-ahead, the same way as the 2026-10-20 change:
  1. Extend the `lesson_type` CHECK.
  2. Add the three cases to `booking_duration`.
  3. Reindex `bookings_no_overlap`.
  4. Add the columns.

  Existing rows keep their durations.

### Server

- `POST /api/bookings` accepts `lesson_type` and `group_size`. It quotes from
  `src/lib/session-pricing.ts`, rejects sizes outside the format's limits, and stores the quote.
- Availability blocks each type's duration through the existing interval logic.

### Everywhere a booking appears

These show the format, length, group size, price per person, and total:
- the student and admin emails, and the calendar invite;
- the Admin booking row;
- the morning outcome digest;
- the review request.

## 5. Built so far

`src/lib/session-pricing.ts` holds DeMario's table and `quoteSession()`, which throws on an
invalid size or length instead of guessing. `src/lib/session-pricing.test.ts` checks every
price, both size limits, and the drilling length rule.

## 6. Decisions for Tonio

1. **Group Clinic.** It is 90 minutes for 3 to 4 players at $50 each. A 90-minute drilling
   session for the same group costs $35 or $30 each. Does drilling replace the clinic?
   Recommendation: yes, retire Group Clinic so two offers do not compete. Confirm with DeMario.
2. **Play with the Pro on the calendar.** Should it block 2 hours or 1? Recommendation: 2
   hours, so nothing can be booked into the second hour. DeMario can release time by hand.
3. **Who pays.** Recommendation: the person who books pays the group total, as the clinic works
   today. The confirmation and `/pay` show the total.
4. **Waiver for the rest of the group.** Today only the person booking accepts the coaching
   terms. Groups of up to 8 widen that gap. Recommendation: launch on the clinic's precedent,
   and add this to the open waiver-version question for whoever advises on the waiver.
5. **Descriptions.** Each format needs one line saying what a session looks like, and what
   separates a one-player drilling session ($60) from Foundations ($70). DeMario writes them,
   or Claude drafts and DeMario approves.

## 7. Verification plan

- **Unit:**
  - every price (done);
  - booking validation: unknown type, sizes outside the limits, a missing length;
  - parity between `LESSON_DURATION_MINUTES` and `booking_duration`.
- **Playwright:** book each format on a public court; check the quote line's numbers, the
  stepper limits, and the layout at 320px.
- **After deploy:** one real booking per format with DeMario, folded into the live booking QA
  in `docs/LAUNCH_OUTSTANDING.md`.

## 8. Not in scope

- Packages and lesson credits: not yet priced.
- Stripe.
- Collecting every player's name or waiver: unless decision 4 says otherwise.
- Recurring group sessions.
