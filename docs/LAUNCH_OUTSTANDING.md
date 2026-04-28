# Public Launch Outstanding Notes

Last updated: 2026-04-28

This file captures the remaining business and operational items that code cannot fully prove on its own. The app can support public launch once the code gates and these manual gates are complete.

## Must Confirm Before Broad Public Launch

### Review and testimonial proof

- Current site surfaces include student stories plus the `5.0` and `79 reviews` trust claim.
- Confirm the review count/rating source before broad promotion.
- Confirm each testimonial or student story is real, permissioned, and acceptable to publish.
- If the source or permission is not ready, replace the claim with softer copy until Mario has proof.

Owner: Mario, with Tonio updating copy if needed.

Acceptable proof: Google Business Profile, TeachMe.To profile, another public review source, or direct written permission from the student for private testimonials.

### Venue and platform permission

- Confirm where Mario can accept direct bookings from `demariomontezpb.com`.
- Confirm venue/platform rules for Dallas Indoor Pickleball Club, The Grove, Samuel-Grand, Life Time, TeachMe.To, PodPlay, and any other platform or venue Mario uses.
- Confirm court fee, reservation, cancellation, insurance, coaching permission, and exclusivity rules.
- Keep written confirmation or written restrictions somewhere Mario can reference.

Owner: Mario.

### Insurance, waiver, and policy review

- Confirm coaching insurance is active.
- Confirm waiver, terms, cancellation policy, and payment expectations have been reviewed by the insurance carrier, broker, or a Texas sports/recreation attorney.
- If Mario chooses to launch before legal review, record that as an accepted business risk.

Owner: Mario.

### Production monitoring

- Configure the production monitoring DSN in Vercel before broad launch.
- Log into admin with MFA and call `POST /api/monitoring-test`.
- Confirm the test error appears in Sentry or the selected monitoring tool.

Owner: Tonio.

### Supabase launch hardening

- Apply P0/P1 SQL in Supabase.
- Confirm waiver columns exist.
- Confirm the active-booking unique index exists.
- Confirm rate-limit table/RLS exists.
- Confirm anonymous users cannot read or write private tables.

Owner: Tonio.

### Live booking QA

- Submit one real test booking with phone, preferred court setup, and preferred area/court.
- Confirm the student email, admin email, calendar invite, Google Calendar link, payment links, QR code, and admin booking row all show the expected details.
- Cancel the test booking from admin and confirm the cancellation email arrives.
- Confirm a busy Google Calendar event blocks a public booking slot.

Owner: Tonio and Mario.

## Operational Facts

### Google Calendar FreeBusy

The site does not poll Google Calendar in the background. It checks FreeBusy on demand when availability loads and again when a student submits a booking. That keeps availability fresh enough for launch and avoids storing calendar event details.

If traffic grows, consider adding a very short server-side cache or client-side debounce. The final booking submit should still check Google Calendar before inserting a booking.

### Admin booking actions

- `Confirm` marks the booking status as confirmed. It does not email the student.
- `Cancel` marks the booking cancelled and sends the cancellation email.
- `Mark paid` toggles the `paid_at` timestamp after Mario receives Cash App, Zelle, or PayPal.
- Mario should text each new student to confirm the exact court, any court reservation fee, and payment expectation.

### Payment and court fees

The booking confirmation and payment cards show the lesson fee. Any indoor or reserved court fee is confirmed separately by Mario before the lesson.

## Good Post-Launch Improvements

- Add click-to-text or click-to-call actions in the admin booking row.
- Add admin filters for upcoming, pending, unpaid, and cancelled bookings.
- Add structured venue selection once venue/platform rules are fully settled.
- Add a short availability debounce/cache if public traffic increases.
- Replace static review claims with linked review-source badges when Mario's review profiles are ready.
