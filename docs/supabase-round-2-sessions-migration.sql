-- Round 2 sessions: Drilling Sessions and Play with the Pro.
-- Spec: docs/specs/2026-10-20-drilling-and-play-with-the-pro.md
--
-- Applied to production 2026-10-21 01:49 UTC, with Tonio's go-ahead, before the
-- code that books these formats deployed. Every VERIFY query below matched.
-- One transaction; safe to re-run.
--
-- What changes:
--   1. bookings.lesson_type also accepts drill_60, drill_90, and play_pro.
--   2. booking_duration() gives their lengths: 60, 90, and 60 minutes. Play
--      with the Pro runs one to two hours at one price and blocks one (spec
--      decision 2); DeMario extends a longer session on his own calendar.
--   3. bookings_no_overlap is rebuilt, so its index is computed with the new
--      function.
--   4. Three new columns hold a group booking's quote, as it was priced when
--      the student booked: group_size, quoted_per_person_cents, and
--      quoted_total_cents. Group formats must have all three and the other
--      lessons none (bookings_group_quote_check). The clinic's group size is
--      never collected, so it stays null rather than a made-up 1.
--
-- Existing rows keep their durations: booking_duration() returns the same
-- values for beginner, advanced, and clinic as before. All 8 bookings to
-- 2026-10-20 are beginner and leave the new columns null, so every constraint
-- below holds for them.
--
-- src/lib/lesson-types.test.ts reads this file. It fails if the lesson types,
-- the durations, or the group size limits here stop matching the code.

begin;

-- 1. The lesson types. Mirrors LESSON_TYPES in src/lib/lesson-types.ts.
alter table public.bookings drop constraint if exists bookings_lesson_type_check;
alter table public.bookings add constraint bookings_lesson_type_check
  check (lesson_type in ('beginner', 'advanced', 'clinic', 'drill_60', 'drill_90', 'play_pro'));

-- 2. Their lengths in minutes. Mirrors LESSON_DURATION_MINUTES in
-- src/lib/business.ts. IMMUTABLE, as an exclusion constraint requires. The
-- else branch is unreachable for a stored row: the CHECK above allows only
-- the six types.
create or replace function public.booking_duration(typ text)
returns integer language sql immutable as $$
  select case typ
    when 'beginner' then 60
    when 'advanced' then 75
    when 'clinic' then 90
    when 'drill_60' then 60
    when 'drill_90' then 90
    when 'play_pro' then 60
    else 60
  end
$$;

-- 3. Rebuild the overlap backstop (first added by
-- docs/supabase-booking-overlap-migration.sql) on the new function.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
exclude using gist (
  lesson_date with =,
  int4range(
    booking_minutes(lesson_time),
    booking_minutes(lesson_time) + booking_duration(lesson_type)
  ) with &&
)
where (status <> 'cancelled' and status <> 'no_show');

-- 4. A group booking's quote, in whole cents. Size limits mirror
-- GROUP_SIZE_LIMITS in src/lib/session-pricing.ts.
alter table public.bookings
  add column if not exists group_size smallint,
  add column if not exists quoted_per_person_cents integer,
  add column if not exists quoted_total_cents integer;

alter table public.bookings drop constraint if exists bookings_group_quote_check;
alter table public.bookings add constraint bookings_group_quote_check check (
  case
    when lesson_type in ('drill_60', 'drill_90', 'play_pro') then
      group_size is not null
      and quoted_per_person_cents is not null
      and quoted_total_cents is not null
      and group_size >= 1
      and group_size <= (case when lesson_type = 'play_pro' then 4 else 8 end)
      and quoted_per_person_cents > 0
      and quoted_total_cents = quoted_per_person_cents * group_size
    else
      group_size is null and quoted_per_person_cents is null and quoted_total_cents is null
  end
);

-- PostgREST caches the schema. Without this, inserts naming the new columns
-- can fail until the cache refreshes on its own.
notify pgrst, 'reload schema';

commit;

-- VERIFY, read-only, after the commit:
--
--   select t, booking_duration(t)
--   from unnest(array['beginner','advanced','clinic','drill_60','drill_90','play_pro']) as t;
--   -- 60, 75, 90, 60, 90, 60
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.bookings'::regclass
--     and conname in ('bookings_lesson_type_check', 'bookings_no_overlap', 'bookings_group_quote_check');
--
--   select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema = 'public' and table_name = 'bookings'
--     and column_name in ('group_size', 'quoted_per_person_cents', 'quoted_total_cents');
