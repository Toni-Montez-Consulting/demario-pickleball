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
- Indoor / weather-proof explains that partner-platform courts use their own booking systems.
- Dallas Indoor Pickleball Club and The Grove route to PodPlay.
- Life Time is presented as member booking through Life Time.
- TeachMe.To routes to TeachMe.To for packages, payment, waivers, and insurance.
- Samuel-Grand is presented as hybrid: court reservation through Impact Activities, coaching fee coordinated with Mario.
- Booking modal requires phone and preferred court setup before the student can continue.
- Booking modal sends Indoor / weather-proof students to guided venue routing before showing site times.
- Booking modal lets Outdoor public court and Help me choose continue to available site times.
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
- Verify venue/location copy matches `docs/VENUE_RULES.md` before accepting live bookings.
- Verify public courts are the only direct site-booking court path unless a future venue rule explicitly allows direct scheduling.

## Admin & Security

- Enroll and verify MFA for each admin account.
- Confirm `/admin` redirects unauthenticated users to login.
- Confirm each admin reaches `aal2` after MFA verification.
- Confirm admin API routes reject an allowed admin email that is not currently `aal2`.
- Confirm `ADMIN_EMAIL` includes only the intended admins before launch.

## Production Monitoring

- Sentry is recommended for long-term operations, but it is not a current launch blocker if Mario and Tonio accept that risk.
- When ready, add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` to Vercel production.
- Add `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` if source-map upload is enabled for production builds.
- Redeploy production after adding monitoring env vars.
- While logged in as an MFA-verified admin, send `POST /api/monitoring-test` in production or preview.
- Confirm the test event appears in Sentry.

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

- The launch venue routing matrix is reflected in the site workflow and `docs/VENUE_RULES.md`.
- Any future TeachMe.To, Grove/PodPlay, Dallas Indoor/PodPlay, Life Time, Impact, venue, contractor, exclusivity, referral fee, court fee, insurance, cancellation, and waiver restrictions are captured before adding a new booking path.
- Insurance is active.
- Waiver/terms review and payment/cancellation policy are treated as sorted for launch, with proof kept on file.
- Cancellation/payment policy is final.
- Mario has reviewed `docs/MARIO_ACTION_PLAN.md`.
- `/admin/tasks` contains only real, current Mario tasks; no test tasks or developer-only work.
- `/admin/roadmap` uses plain-language Mario actions with clear done conditions.

## Broader Promotion Gates

- Rate limiting and honeypot protection are active on public booking and inquiry forms.
- Production error monitoring is configured and a test event has been received, or Mario and Tonio have explicitly accepted Sentry as a post-launch follow-up.
- Dependency advisories have been reviewed in `docs/DEPENDENCY_ADVISORIES.md`.
- Historical audit/planning docs have been reviewed against current docs.
