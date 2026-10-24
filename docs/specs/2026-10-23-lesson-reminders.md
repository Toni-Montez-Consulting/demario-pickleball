# Day-Before Lesson Reminders

**Status:** built 2026-10-23, not live. Two things come first: the database column, and Tonio's
call on the privacy wording (section 4).

## 1. The problem

A student books on the site, gets one confirmation email, and hears nothing else unless
DeMario texts. Nothing reminds them the day before, which is when no-shows and "where are we
playing?" happen.

## 2. Design

- A daily cron, `/api/cron/lesson-reminders`, runs at 14:00 UTC: 9 AM in Dallas during daylight
  time, 8 AM in winter.
- It emails each student whose lesson is tomorrow, Dallas date. It skips three cases:
  - a booking that is not pending (cancelled, or already given an outcome);
  - a booking that has already been reminded;
  - a booking made in the last 12 hours, which has just had its confirmation.
- The email (`lessonReminderHtml`):
  - gives the lesson, players, date, time, and booking ID;
  - says to text DeMario at his number if the court is not settled yet, or if something has changed;
  - ends with "If you and DeMario already changed plans, you can ignore this email."
  - DeMario sometimes cancels by text without updating the site, so the email never claims
    the lesson is definitely on.
- Claim-first, like the review-request cron. `bookings.reminder_sent_at` is stamped before
  sending, so a duplicate Vercel run cannot send twice. A failed send releases the stamp and
  is logged by booking ID. There is no retry, because the next run is after the lesson.

## 3. Before merging

1. Apply `docs/supabase-lesson-reminder-migration.sql`: one nullable column. Without it the
   cron answers 500 every morning; a test pins that.
2. Decide the privacy wording (below).

## 4. Open: the privacy policy

The policy said "To send lesson reminders (if you opt in)", and the booking form has no
opt-in. This PR changes the line to "To remind you by email the day before a lesson you booked
on this site", which treats the reminder as part of managing the booking. The other choice is
an opt-in checkbox on the booking form, which needs its own column and form change.

## 5. Limitations check

- **Known ceiling:** only site bookings get a reminder. Lessons booked through TeachMe.To or
  venue apps never reach this database.
- **Typical failure mode:** a lesson DeMario cancelled by text still gets "See you tomorrow".
  The email's last line covers it, but only DeMario recording cancellations fixes it.
- **Alternatives:** an SMS reminder. It would be read more often, but it needs a paid SMS
  provider and consent to texts.
- **Verdict:** use email now. Look at SMS only if no-shows stay a problem.
