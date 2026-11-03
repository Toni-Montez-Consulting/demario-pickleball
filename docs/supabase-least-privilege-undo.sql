-- Undo docs/supabase-least-privilege-migration.sql.
--
-- Puts back Supabase's default grants for the browser roles, the two "Public
-- select" policies, and the helper functions' settings exactly as they were
-- before it (read from production on 2026-10-24). Run it only if the site
-- breaks after the migration, then find what needed the access.

begin;

grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

create policy "Public select blocked_slots" on public.blocked_slots
  for select to public using (true);
create policy "Public select recurring_blocks" on public.recurring_blocks
  for select to public using (true);

alter function public.booking_minutes(text) reset search_path;
alter function public.booking_duration(text) reset search_path;
grant execute on function public.booking_minutes(text), public.booking_duration(text)
  to public, anon, authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated;

commit;
