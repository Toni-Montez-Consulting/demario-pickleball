-- Students + Reviews migration
-- Run once in the Supabase SQL Editor. Idempotent: safe to re-run.
-- Spec:  docs/specs/2026-07-25-student-spine-and-review-loop.md
-- Plan:  docs/plans/2026-07-25-student-spine-and-review-loop.md

-- ---------------------------------------------------------------------------
-- 1. students
-- ---------------------------------------------------------------------------

create table if not exists students (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone_normalized    text,
  email_normalized    text,
  source              text not null default 'site',
  notes               text,
  first_seen_at       timestamptz not null default now(),
  last_lesson_at      timestamptz,
  needs_review        boolean not null default false,
  needs_review_reason text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Canonical keys. Partial unique so a student may have only one of the two.
create unique index if not exists students_phone_key
  on students (phone_normalized) where phone_normalized is not null;
create unique index if not exists students_email_key
  on students (email_normalized) where email_normalized is not null;

-- ---------------------------------------------------------------------------
-- 2. bookings: link to students, track review asks, allow no_show
-- ---------------------------------------------------------------------------

alter table bookings add column if not exists student_id uuid references students(id) on delete set null;
alter table bookings add column if not exists review_request_sent_at timestamptz;
create index if not exists bookings_student_id_idx on bookings (student_id);

-- PRE-FLIGHT: run this first and confirm every value is in the allowlist below.
-- If a status exists that is not in ('pending','confirmed','cancelled','no_show'),
-- the next block will fail loudly rather than silently narrowing the column.
-- Add the missing value to the allowlist before continuing.
--
--   select status, count(*) from bookings group by status order by 2 desc;

-- Widen any existing status CHECK constraint to include 'no_show'.
-- Written as a DO block so it works whether or not a CHECK exists today,
-- and whatever that constraint happens to be named.
do $$
declare
  con record;
begin
  for con in
    select conname
    from pg_constraint
    where conrelid = 'bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table bookings drop constraint %I', con.conname);
  end loop;

  alter table bookings
    add constraint bookings_status_check
    check (status in ('pending','confirmed','cancelled','no_show'));
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. reviews
-- ---------------------------------------------------------------------------

create table if not exists reviews (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references students(id) on delete set null,
  booking_id        uuid references bookings(id) on delete set null,
  rating            smallint not null check (rating between 1 and 5),
  body              text,
  display_name      text not null,
  lesson_context    text,
  -- Mario's editorial metadata, set at publish time. Not the student's words.
  -- A review with a takeaway is promoted to the featured carousel slot.
  tag               text,
  takeaway          text,
  consent_publish   boolean not null,
  verified_booking  boolean not null default false,
  source            text not null default 'site',
  status            text not null default 'pending'
                      check (status in ('pending','published','hidden')),
  token_hash        text unique,
  token_used_at     timestamptz,
  submitted_ip_hash text,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  -- A review without publish consent must be impossible to store, not merely
  -- rejected at the API layer.
  constraint reviews_consent_required check (consent_publish)
);

create index if not exists reviews_status_idx on reviews (status, published_at desc);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
-- No anon policies are created. All reads and writes go through Next.js API
-- routes using the service-role key, matching bookings and inquiries.

alter table students enable row level security;
alter table reviews  enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Legacy testimonial seed
-- ---------------------------------------------------------------------------
-- Carries over all seven testimonials currently hardcoded in the site so the
-- review wall does not shrink when the homepage switches to database-driven
-- reviews.
--
--   * The first three come from REVIEWS in src/lib/data.ts. DeMario confirmed
--     these are real and permissioned on 2026-07-25. They have tag + takeaway,
--     which places them in the featured carousel.
--   * The last four come from REVIEW_WALL in src/components/Testimonials.tsx.
--     THESE ARE NOT YET CONFIRMED. If DeMario cannot vouch for them, delete
--     that second insert before running this migration.

insert into reviews (rating, body, display_name, lesson_context, tag, takeaway,
                     consent_publish, verified_booking, source, status, published_at)
select v.rating, v.body, v.display_name, v.lesson_context, v.tag, v.takeaway,
       true, false, 'legacy', 'published', now()
from (values
  (5, 'DeMario doesn''t just teach you how to hit the ball — he teaches you how to think the point. Two months in and I''m reading opponents in a way I never could before.',
      'Rachel K.', 'Intermediate · 12 lessons', 'Strategy', 'Better point construction'),
  (5, 'Most coaches feed you balls for an hour. DeMario built a real plan around my weak spots. My DUPR jumped 0.4 in a season.',
      'Marcus T.', 'Competitive · 20 lessons', 'Competitive', 'Targeted practice plan'),
  (5, 'I was the person dinking into the net every point. After four sessions I played my first tournament — and won my first match.',
      'Jenna P.', 'Beginner · 6 lessons', 'Beginner', 'First tournament confidence')
) as v(rating, body, display_name, lesson_context, tag, takeaway)
where not exists (
  select 1 from reviews r where r.source = 'legacy' and r.display_name = v.display_name
);

insert into reviews (rating, body, display_name, lesson_context,
                     consent_publish, verified_booking, source, status, published_at)
select v.rating, v.body, v.display_name, v.lesson_context,
       true, false, 'legacy', 'published', now()
from (values
  (5, 'Actually explains why, not just what. Game-changer.', 'David L.', 'Shot selection'),
  (5, 'Patient, sharp, and fun. My wife and I both take lessons now.', 'Carlos M.', 'Doubles lessons'),
  (5, 'First coach that made strategy feel doable at a 3.0 level.', 'Priya S.', 'Beginner strategy'),
  (5, 'Showed up for my tournament to scout opponents. Unreal.', 'Tom B.', 'Tournament support')
) as v(rating, body, display_name, lesson_context)
where not exists (
  select 1 from reviews r where r.source = 'legacy' and r.display_name = v.display_name
);

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
-- Run these after the migration and confirm each returns what you expect.
--
--   select count(*) from students;                          -- 0 until the backfill runs
--   select count(*) from reviews where source = 'legacy';    -- 7 (or 3 if the wall was cut)
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--     where conrelid = 'bookings'::regclass and contype = 'c';
--   select column_name from information_schema.columns
--     where table_name = 'bookings' and column_name in ('student_id','review_request_sent_at');
