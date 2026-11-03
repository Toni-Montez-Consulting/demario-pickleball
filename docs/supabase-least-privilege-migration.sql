-- Browser roles get only what the site uses (chore/db-least-privilege).
--
-- The site reads and writes its tables through the server's service-role
-- client. The one exception is the public lesson-times list: GET
-- /api/time-slots reads time_slots with the anon key, through the "Public
-- select time_slots" policy (see docs/supabase-service-role-only-migration.sql).
--
-- Until now Supabase's default grants gave anon (anyone holding the public key)
-- and authenticated (any signed-in account) every privilege on every table, so
-- row-level security was the only barrier. It held, but one missing or
-- mistaken policy would have been enough. After this:
--   - anon can SELECT time_slots and nothing else in public;
--   - authenticated has nothing in public (admins sign in, then the server
--     reads with the service role);
--   - tables and sequences that postgres creates later in public start with no
--     grants for either role;
--   - the two unused "Public select" policies are gone, so RLS also refuses
--     those reads if a grant ever comes back;
--   - the two helper functions behind bookings_no_overlap run with an empty
--     search_path (Supabase advisor: function_search_path_mutable) and only the
--     server roles can call them. Their bodies use built-ins only.
--
-- The service role keeps every privilege and bypasses RLS, so the site, the
-- admin pages, and the crons are unaffected. Plain DROP POLICY on purpose, as
-- in the service-role-only migration: a second run fails and rolls back
-- instead of doing something different. Undo:
-- docs/supabase-least-privilege-undo.sql.
--
-- Tested before production on PGlite (PostgreSQL 18) with Supabase's roles
-- and default grants rebuilt: the anon lesson-times read still works, every
-- other browser-role read and write is refused, the overlap constraint still
-- refuses a double booking, a second run rolls back, and the undo restores
-- the previous grants and policies.

begin;

-- 1. Tables and sequences: nothing for the browser roles, except the read the
--    public booking widget makes with the anon key.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.time_slots to anon;

-- 2. The public read policies nothing uses.
drop policy "Public select blocked_slots" on public.blocked_slots;
drop policy "Public select recurring_blocks" on public.recurring_blocks;

-- 3. The overlap constraint's helper functions.
alter function public.booking_minutes(text) set search_path = '';
alter function public.booking_duration(text) set search_path = '';
revoke execute on function public.booking_minutes(text), public.booking_duration(text)
  from public, anon, authenticated;

-- 4. Tables and sequences postgres creates later in public. Supabase's
--    defaults grant the browser roles everything on them.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

commit;

-- VERIFY 1 (expect exactly one row: time_slots | anon | SELECT)
-- select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public' and grantee in ('anon', 'authenticated')
--  order by 1, 2, 3;
--
-- VERIFY 2 (expect one row: time_slots | Public select time_slots)
-- select tablename, policyname from pg_policies where schemaname = 'public';
--
-- VERIFY 3 (expect both functions with {"search_path=\"\""} and an ACL with
-- only postgres and service_role)
-- select proname, proconfig, proacl from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('booking_minutes', 'booking_duration');
--
-- VERIFY 4 (expect the r and S rows to list postgres and service_role only)
-- select defaclobjtype, defaclacl from pg_default_acl
--  where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace;
--
-- VERIFY 5, the live site:
--   - https://demariomontezpb.com/api/time-slots lists the lesson times;
--   - the "Site health" workflow passes (Actions -> Site health -> Run workflow);
--   - an admin signs in to /admin and opens Bookings and Availability.
