-- P0 launch-reliability migration for direct site bookings.
-- Run in the Supabase SQL editor before deploying the booking API changes
-- that persist waiver acceptance.

alter table public.bookings
  add column if not exists waiver_signed_at timestamptz,
  add column if not exists waiver_version text;

-- Keep booking PII private. The Next.js API uses the service role after
-- validating inputs and availability; public clients should not read or write
-- bookings directly.
drop policy if exists "bookings public read" on public.bookings;
drop policy if exists "allow_public_bookings_read" on public.bookings;
drop policy if exists "public insert" on public.bookings;

-- Inquiries are inserted by the Next.js API with the service role. Public
-- clients should not read or write submitted inquiry messages directly.
drop policy if exists "inquiries public read" on public.inquiries;
drop policy if exists "allow_public_inquiries_read" on public.inquiries;
drop policy if exists "public insert" on public.inquiries;

-- Expected public read policies after this migration:
-- - time_slots: anon can SELECT active public slot labels
-- - blocked_slots: anon can SELECT date/time/all_day needed for availability
-- - recurring_blocks: anon can SELECT day_of_week/time needed for availability
--
-- Expected private policies:
-- - bookings, inquiries, admin_tasks, roadmap_checks: authenticated admins only
--   through app routes, or service-role access from trusted server code.
