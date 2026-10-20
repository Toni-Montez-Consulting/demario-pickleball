-- Signed-in sessions get no table access of their own.
-- Applied to production on 2026-10-20 at 00:33 UTC through the Supabase CLI
-- (`supabase db query --linked`), after Tonio's go-ahead. Kept here as the record.
--
-- The app reads and writes these tables only through the server's service-role
-- client: admin pages, and admin API routes after requireAdmin() has checked the
-- allowed-admin email list and MFA (aal2). The browser client is used only for
-- login, MFA, and sign-out. These policies gave every signed-in Supabase
-- account, admin or not and with or without MFA, the same access through
-- Supabase's REST API, so they were dropped. Public sign-ups were turned off the
-- same night.
--
-- RLS stays enabled on every table. With no policy for a role, that role sees
-- and changes nothing; the service role bypasses RLS. Three "Public select"
-- policies stay. The one on time_slots is needed: the public booking widget
-- reads lesson times with the anon key (GET /api/time-slots). The ones on
-- blocked_slots and recurring_blocks are not used by the app, which reads both
-- through the service role; those tables hold only dates and times.
--
-- Plain DROP POLICY on purpose: if a policy had been renamed, the statement
-- would fail and the whole transaction roll back instead of leaving access.

begin;

drop policy "authenticated select bookings" on public.bookings;
drop policy "authenticated update bookings" on public.bookings;
drop policy "authenticated select inquiries" on public.inquiries;
drop policy "authenticated update inquiries" on public.inquiries;
drop policy "Authenticated users full access" on public.admin_tasks;
drop policy "Authenticated full access blocked_slots" on public.blocked_slots;
drop policy "Authenticated full access recurring_blocks" on public.recurring_blocks;
drop policy "Authenticated full access roadmap_checks" on public.roadmap_checks;
drop policy "Authenticated full access time_slots" on public.time_slots;

commit;

-- Verify: this returns only the three "Public select" policies.
-- select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by 1, 2;
