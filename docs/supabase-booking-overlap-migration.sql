-- Prevent overlapping bookings
-- Applied to production 2026-07-28. Idempotent: safe to re-run.
--
-- WHY: lessons run 60/75/90 minutes against hourly time slots (plus a 5:30 PM),
-- but availability only ever blocked the exact start label of an existing
-- booking. A 90-minute Group Clinic at 5:00 PM runs to 6:30 and left both
-- 5:30 PM and 6:00 PM bookable. Both students got a confirmation email. Nobody
-- found out until DeMario turned up to two students at once.
--
-- src/lib/availability.ts now expands each booking to an interval and reuses the
-- same overlap test the Google Calendar path already used. This constraint is
-- the backstop underneath that, so a bug, a manual insert, or a race fails loudly
-- instead of silently double-booking a real lesson.

create extension if not exists btree_gist;

-- Display labels are text ("5:00 PM"). Parse to minutes-since-midnight with
-- pure string arithmetic so the expression is IMMUTABLE, which an exclusion
-- constraint requires. to_timestamp() is only STABLE and cannot be used here.
--   "12:00 AM" -> 0     "7:00 AM" -> 420
--   "12:00 PM" -> 720   "5:30 PM" -> 1050
create or replace function booking_minutes(t text)
returns integer language sql immutable strict as $$
  select ((split_part(split_part(t, ':', 1), ' ', 1))::int % 12) * 60
       + (split_part(split_part(t, ' ', 1), ':', 2))::int
       + (case when upper(t) like '%PM%' then 720 else 0 end)
$$;

-- Mirrors LESSON_DURATION_MINUTES in src/lib/business.ts. If those durations
-- change, change them here too — this is a deliberate duplication because an
-- exclusion constraint cannot read application code.
create or replace function booking_duration(typ text)
returns integer language sql immutable as $$
  select case typ when 'clinic' then 90 when 'advanced' then 75 else 60 end
$$;

-- PRE-FLIGHT: this must return zero rows, or the constraint below will fail.
-- Resolve any existing overlaps first.
--
--   select a.id, a.lesson_date, a.lesson_time, b.id as conflicts_with
--   from bookings a join bookings b
--     on a.id < b.id and a.lesson_date = b.lesson_date
--    and a.status not in ('cancelled','no_show')
--    and b.status not in ('cancelled','no_show')
--    and int4range(booking_minutes(a.lesson_time),
--                  booking_minutes(a.lesson_time) + booking_duration(a.lesson_type))
--     && int4range(booking_minutes(b.lesson_time),
--                  booking_minutes(b.lesson_time) + booking_duration(b.lesson_type));

alter table bookings drop constraint if exists bookings_no_overlap;

alter table bookings add constraint bookings_no_overlap
exclude using gist (
  lesson_date with =,
  int4range(
    booking_minutes(lesson_time),
    booking_minutes(lesson_time) + booking_duration(lesson_type)
  ) with &&
)
where (status <> 'cancelled' and status <> 'no_show');

-- The API surfaces the resulting 23P01 as the same friendly 409 a student
-- already sees for the exact-slot unique index. See src/app/api/bookings/route.ts.
--
-- VERIFY: inserting a 90-minute clinic at 5:00 PM then a 60-minute lesson at
-- 6:00 PM on the same date must raise exclusion_violation.
