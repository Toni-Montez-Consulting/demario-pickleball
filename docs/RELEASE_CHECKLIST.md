# Release Checklist

Use this before promoting changes to `demariomontezpb.com`.

## Code

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- Confirm the latest GitHub Actions CI run is green.

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
- Submit a test booking.
- Confirm student confirmation email arrives.
- Confirm admin notification email arrives.
- Cancel the test booking from admin and confirm cancellation email arrives.
- Check payment links and QR rendering on booking confirmation and `/pay`.
- Enroll and verify MFA for each admin account.
- Confirm DeMario knows the weekly admin routine: review bookings, inquiries, unpaid lessons, and blocked dates.
- Review `docs/ADMIN_HANDOFF.md` with DeMario.

## Business Gates

- Direct-booking venue is confirmed in writing.
- Insurance is active.
- Waiver/terms are reviewed by a Texas sports/recreation attorney and insurance carrier or broker.
- Cancellation/payment policy is final.

## Broader Promotion Gates

- Rate limiting and honeypot protection are active on public booking and inquiry forms.
- Production error monitoring is configured.
- Dependency advisories have been reviewed in `docs/DEPENDENCY_ADVISORIES.md`.
- Historical audit/planning docs have been reviewed against current docs.
