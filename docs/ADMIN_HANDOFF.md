# Admin Handoff

Use this when showing DeMario how to operate the site.

For the plain-language owner checklist, use `docs/MARIO_ACTION_PLAN.md`.

## Daily

- Open `/admin` and review new bookings.
- Text or email each new student to confirm the lesson details and court plan.
- Check payment memos for the booking ID shown in the confirmation email.
- Mark paid lessons as paid after Cash App, Zelle, or PayPal is received.
- Reply to unread inquiries.

## Weekly

- Review the upcoming week of bookings.
- Block unavailable dates or times before students can book them.
- Confirm recurring unavailability still matches the real lesson schedule.
- Clear completed follow-up tasks.
- Check the Business roadmap for the next operating task.
- Keep Tasks limited to short-term actions Mario can finish this week or next.

## When Cancelling

- Use the admin Cancel action so the student gets the cancellation email.
- Text the student as a backup for same-day or urgent changes.
- If the lesson is moved instead of cancelled, cancel the old booking and create or ask for a new booking at the new time.

## Before Broader Promotion

- Confirm venue permission in writing.
- Confirm insurance is active.
- Confirm waiver and terms were reviewed by a Texas sports/recreation attorney and the insurance carrier or broker.
- Confirm rate limiting is active by running `docs/supabase-p1-hardening.sql`.
- Confirm Google Calendar blocking is connected in Admin -> Availability.
- Confirm DUPR automation is still manual until DUPR grants read-only API or partner access.
