# One-Tap Cancel and the "Tomorrow" Email

**Status:** built 2026-10-23. Asked for by Tonio the same day ("Any other ways to enhance the
platform? Let's roll").

## 1. The problem

DeMario cancels lessons by text and does not open Admin. A lesson he called off stayed
"pending", which had three effects:

- the student still got the day-before "See you tomorrow" email (#37);
- the time stayed blocked on the site;
- his morning email later asked whether the lesson happened.

## 2. Product questions

1. **Who uses it?** DeMario, on his phone, from an email. Nobody else gets the link.
2. **The one decision:** cancel this lesson, or leave it.
3. **What he already knows:** the email-button pattern from his morning outcome email and the
   review takedown. A button opens a page, and a second button there acts.
4. **What it cannot do:**
   - cancel a lesson that has started (the morning email's "Didn't happen" covers that);
   - change a lesson that already has an outcome;
   - move a lesson to another time. Moving is still: cancel, then rebook.
5. **What we protect:**
   - The student gets the same cancellation email Admin's Cancel sends, with the calendar
     file that removes the lesson. Only one email is sent, even if he taps twice.
   - The link names one booking, is signed, and expires in 45 days.
   - Mail scanners that open links change nothing.
6. **What must be true before the change:** a valid link, a booking that is still pending, and
   a lesson that has not started.
7. **Success:** a lesson called off by text is cancelled before its student is reminded.

## 3. Design

- `src/lib/lesson-cancel.ts`: the signed link (the outcome secret, under its own domain prefix,
  so outcome and review links never pass as cancel links) and the page's states.
- `/cancel-lesson/[token]` shows the lesson. Its button posts to `/api/cancel-lesson`.
  - The route moves `pending` to `cancelled` only if the row is still pending.
  - Only the request that moved it emails the student.
- **Where the link appears:**
  - DeMario's new-booking email, with **Add to my calendar**: a Google Calendar link naming
    the student, with their phone and court setup.
  - A new **"Tomorrow" email** (`/api/cron/coach-tomorrow`, 14:00 UTC, 9 AM Dallas time). It
    lists tomorrow's pending site lessons with time, student, lesson, group size, court notes,
    and Text and Call links. It sends nothing on a day without one.
- **Students' reminders move to 23:00 UTC** (6 PM Dallas, 5 PM in winter). That gives DeMario
  nine hours between his email and theirs. No reminder had been sent yet when this changed.
- `/cancel-lesson/<token>` joins `TOKEN_ROUTES`, so analytics never sees the token.

## 4. Limitations check

- **Known ceiling:** it only reaches lessons booked on the site. TeachMe.To and venue lessons
  are not in the database.
- **Typical failure mode:** DeMario ignores the email, and the old behavior returns: the
  reminder still says "if plans changed, ignore this".
- **Alternatives:** students cancelling themselves from their own emails. That needs DeMario's
  rules for late cancellations, so it waits for him.
- **Verdict:** use it. It moves Admin's existing Cancel into the place DeMario already acts.
