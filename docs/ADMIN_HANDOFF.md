# Admin Handoff

Use this when showing DeMario how to operate the site.

For the plain-language owner checklist, use `docs/MARIO_ACTION_PLAN.md`.

## New Admin Setup

- Add the new admin email to production `ADMIN_EMAIL`, redeploy, and send a
  Supabase invite.
- Create an `/admin/tasks` item in the `Admin onboarding` category with the
  invite, MFA, bookings, inquiries, availability, payment, and cancellation
  steps.
- The new admin should accept the invite, set a password, then enroll 2-factor
  auth from `/admin/mfa-setup` before handling private booking data.
- For Leah, the live onboarding task is titled
  `Leah admin onboarding: accept invite, set up MFA, and learn the daily flow`.

## Daily

- **Morning email "Did this lesson happen?"** arrives the morning after a lesson booked through
  the site. Tap **Lesson happened**, **No-show**, or **Didn't happen** for each lesson, then
  confirm on the page that opens. "Lesson happened" is what lets the site ask the student for
  a review. Nothing is sent to the student for the other two, and once recorded they can't be
  changed back to a lesson that happened. Each lesson drops off after three mornings; older
  ones are under **Needs outcome** in `/admin`: **Lesson happened**, **No show**, or
  **Didn't happen** (the Cancel button, renamed once a lesson has started, which emails no
  one). **Lesson happened** works only once the lesson has started, so confirming the court
  by text beforehand can never trigger a review request.
- **A lesson moved by text:** mark the original **Didn't happen**, then book the new date as
  its own booking on the site, or have the student rebook. Each lesson keeps its own outcome.
  Only **Lesson happened** asks the student for a review; **Didn't happen** and **No-show**
  never do.
- Open `/admin` and review new bookings.
- Text each new student using the phone number in the booking row.
- Confirm the exact court, any court reservation fee, and payment expectation with the
  student by text. Nothing to click for this in `/admin`.
- Use the student's preferred court setup and preferred area/court note when choosing the court plan.
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

- Use the admin Cancel action so the student gets the cancellation email. A lesson that has
  already started shows **Didn't happen** instead, and no email goes out.
- Text the student as a backup for same-day or urgent changes.
- If the lesson is moved instead of cancelled, cancel the old booking and create or ask for a new booking at the new time.
- Keep cancellation language aligned with the launch policy: 24+ hours can cancel
  or reschedule free, under 24 hours may be charged 50%, no-shows may be charged
  full price, and coach-cancelled sessions get a refund or free reschedule.

## Sharing The Site

Use a different link in each place, so the site can tell which one brings students:

- Instagram bio: `demariomontezpb.com/ig`
- TikTok bio: `demariomontezpb.com/tiktok`
- QR card at courts and the school: `demariomontezpb.com/card`

Each one opens the normal homepage. Every new-booking email has a **Found you through** line:
Instagram bio link, TikTok bio link, QR card, or "No tagged link" (word of mouth, a search, or
the plain address). Swapping the two bio links is a one-time, five-minute job.

## Before Broader Promotion

- Follow `docs/VENUE_RULES.md`: public courts can book through the site; Dallas
  Indoor and The Grove go through PodPlay; Life Time goes through Life Time;
  TeachMe.To stays on TeachMe.To; Samuel-Grand court reservations go through
  Impact before coaching-fee coordination.
- Keep the active coaching liability insurance certificate in a known folder.
- Keep proof that the website Terms, waiver, payment, and cancellation wording
  are the reviewed launch baseline.
- Keep venue/platform permission emails, owner texts, policy pages, or agreements
  somewhere Mario can find them.
- Use the launch payment rules: Cash App, Zelle, or PayPal; booking ID in the
  memo; court reservation fee confirmed separately; mark paid only after payment
  is received.
- Confirm rate limiting is active by running `docs/supabase-p1-hardening.sql`.
- Confirm Google Calendar blocking is connected in Admin -> Availability.
- Confirm DUPR automation is still manual until DUPR grants read-only API or partner access.
