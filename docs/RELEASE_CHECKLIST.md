# Release Checklist

Use this before promoting changes to `demariomontezpb.com`.

See `docs/LAUNCH_OUTSTANDING.md` for the remaining business and operational items that must be confirmed outside the codebase before broad public promotion.

## Code

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- Confirm the latest GitHub Actions CI run is green.

## Location Clarity V1

- Homepage shows **Where We Train** with three clear paths: Indoor / weather-proof, Outdoor public court, and Help me choose.
- Outdoor public parks are grouped in compact copy instead of presented as 8 equal booking choices.
- Samuel-Grand and Life Time are presented as by-request options only.
- Booking modal requires phone and preferred court setup before the student can continue.
- Booking modal stores formatted court preference in `bookings.notes`.
- Confirmation screen says Mario will confirm the exact court after booking.
- Student email, admin email, ICS, and Google Calendar link all say exact court is confirmed by Mario after booking.
- Admin bookings view shows phone and court preference so Mario can text the student without digging.

## Supabase

- Run `docs/supabase-p0-migration.sql`.
- Run `docs/supabase-p1-hardening.sql`.
- Verify `bookings.waiver_signed_at` and `bookings.waiver_version` exist.
- Verify `bookings` and `inquiries` no longer have the exact `public insert` policy.
- Verify anon users cannot read `bookings` or `inquiries`.
- Verify anon users cannot read or write `rate_limit_events`.
- Verify `rate_limit_events` has RLS enabled and no public policies.
- Verify the `bookings_unique_active_slot` partial unique index exists.
- Verify active `time_slots` include the current lesson schedule.
- Verify venue/location copy is correct before accepting live direct bookings.
- Verify each venue/platform allows direct bookings through `demariomontezpb.com` rather than only through the existing platforms.

## Admin & Security

- Enroll and verify MFA for each admin account.
- Confirm `/admin` redirects unauthenticated users to login.
- Confirm each admin reaches `aal2` after MFA verification.
- Confirm admin API routes reject an allowed admin email that is not currently `aal2`.
- Confirm `ADMIN_EMAIL` includes only the intended admins before launch.

## Production Monitoring

- Add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` to Vercel production.
- Add `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` if source-map upload is enabled for production builds.
- Redeploy production after adding monitoring env vars.
- While logged in as an MFA-verified admin, send `POST /api/monitoring-test` in production or preview.
- Confirm the test event appears in Sentry before public launch.

## Google Calendar OAuth

- Confirm the Google Calendar API is enabled in the production Google Cloud project.
- Confirm the OAuth consent screen publishing status is **In production**, not **Testing**.
- Confirm the OAuth consent screen uses `https://demariomontezpb.com` as the app homepage.
- Confirm the OAuth consent screen uses `https://demariomontezpb.com/privacy` as the privacy policy URL.
- Confirm `demariomontezpb.com` is listed as an authorized domain.
- Confirm the only Calendar scope requested is `https://www.googleapis.com/auth/calendar.freebusy`.
- Confirm `/privacy` discloses Google Calendar FreeBusy use and the Google API Services User Data Policy / Limited Use commitment.
- Revoke any old test authorization from DeMario's Google Account before generating the production refresh token.
- Generate a fresh DeMario refresh token after the OAuth app is published to production.
- Update Vercel production `GOOGLE_OAUTH_REFRESH_TOKEN` and redeploy.
- Set `GOOGLE_CALENDAR_SYNC_ENABLED=true` only after the admin Availability diagnostic shows the sync is connected.
- Create a busy Google Calendar event over an active lesson slot and confirm the public booking picker blocks that slot.

## Live Manual Checks

- Submit a test inquiry.
- Submit a test booking with phone, preferred court setup, and preferred area/court.
- Confirm student confirmation email arrives and says Mario will confirm the exact court.
- Confirm admin notification email arrives with student phone and court preference.
- Cancel the test booking from admin and confirm cancellation email arrives.
- Check payment links and QR rendering on booking confirmation and `/pay`.
- Confirm the calendar invite and Google Calendar link use the court-confirmation wording.
- Confirm DeMario knows the weekly admin routine: review bookings, inquiries, unpaid lessons, and blocked dates.
- Confirm Mario's handoff: text each new student to confirm exact court, any court fee, and payment.
- Review `docs/ADMIN_HANDOFF.md` with DeMario.

## Business Gates

- Direct-booking venue/platform permission is confirmed in writing for every place Mario plans to coach from site bookings.
- Any TeachMe.To, Grove/Podplay, Dallas Pickle Club/Podplay, venue, contractor, exclusivity, referral fee, court fee, insurance, cancellation, and waiver restrictions are reflected in the site workflow.
- Insurance is active.
- Waiver/terms are reviewed by a Texas sports/recreation attorney and insurance carrier or broker.
- Cancellation/payment policy is final.
- Mario has reviewed `docs/MARIO_ACTION_PLAN.md`.
- `/admin/tasks` contains only real, current Mario tasks; no test tasks or developer-only work.
- `/admin/roadmap` uses plain-language Mario actions with clear done conditions.

## Broader Promotion Gates

- Rate limiting and honeypot protection are active on public booking and inquiry forms.
- Production error monitoring is configured and a test event has been received.
- Dependency advisories have been reviewed in `docs/DEPENDENCY_ADVISORIES.md`.
- Historical audit/planning docs have been reviewed against current docs.
