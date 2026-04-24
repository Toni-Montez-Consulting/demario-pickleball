# Release Checklist

Use this before promoting changes to `demariomontezpb.com`.

## Code

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Optional after browser install: `npm run test:e2e`

## Supabase

- Run `docs/supabase-p0-migration.sql`.
- Verify `bookings.waiver_signed_at` and `bookings.waiver_version` exist.
- Verify `bookings` and `inquiries` no longer have the exact `public insert` policy.
- Verify anon users cannot read `bookings` or `inquiries`.
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

## Business Gates

- Direct-booking venue is confirmed in writing.
- Insurance is active.
- Waiver/terms are reviewed by a Texas sports/recreation attorney and insurance carrier or broker.
- Cancellation/payment policy is final.
