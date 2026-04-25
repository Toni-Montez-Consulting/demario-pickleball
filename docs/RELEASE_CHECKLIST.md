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
