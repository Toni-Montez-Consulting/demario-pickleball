-- Database schema for demariomontezpb.com (Supabase, schema public).
--
-- Rebuilt from the live catalog on 2026-10-24 (PostgreSQL 17.6), as it stands
-- after docs/supabase-least-privilege-migration.sql. Structure and access
-- only: no rows, no secrets. Use it to stand up a test or replacement
-- database: create a Supabase project, then run this whole file in its SQL
-- editor. Never run it against production. Each production change gets its
-- own migration file in docs/ and updates this file in the same PR.
--
-- Checked on 2026-10-24 on PGlite (PostgreSQL 18) with Supabase's roles and
-- default grants rebuilt: it loads cleanly; the STRUCTURE CHECK query at the
-- end gives the same md5 here and on production; and its grants and policies
-- equal what the least-privilege migration leaves on a copy of production's
-- access.

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

-- The overlap constraint compares a date with equality inside a GiST index.
create extension if not exists btree_gist with schema public;

-- Minutes after midnight for a display time like "9:00 AM". Pure string
-- arithmetic, so it is IMMUTABLE, which an exclusion constraint requires.
create or replace function public.booking_minutes(t text)
returns integer language sql immutable strict as $function$
  select ((split_part(split_part(t,':',1),' ',1))::int % 12) * 60
       + (split_part(split_part(t,' ',1),':',2))::int
       + (case when upper(t) like '%PM%' then 720 else 0 end)
$function$;

-- Lesson length in minutes for each lesson type.
create or replace function public.booking_duration(typ text)
returns integer language sql immutable as $function$
  select case typ
    when 'beginner' then 60
    when 'advanced' then 75
    when 'clinic' then 90
    when 'drill_60' then 60
    when 'drill_90' then 90
    when 'play_pro' then 60
    else 60
  end
$function$;

create table public.students (
  id uuid not null default gen_random_uuid(),
  name text not null,
  phone_normalized text,
  email_normalized text,
  source text not null default 'site'::text,
  notes text,
  first_seen_at timestamp with time zone not null default now(),
  last_lesson_at timestamp with time zone,
  needs_review boolean not null default false,
  needs_review_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint students_pkey primary key (id)
);

create table public.bookings (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  name text not null,
  email text not null,
  phone text,
  lesson_type text not null,
  lesson_date date not null,
  lesson_time text not null,
  status text not null default 'pending'::text,
  notes text,
  paid_at timestamp with time zone,
  waiver_signed_at timestamp with time zone,
  waiver_version text,
  student_id uuid,
  review_request_sent_at timestamp with time zone,
  group_size smallint,
  quoted_per_person_cents integer,
  quoted_total_cents integer,
  reminder_sent_at timestamp with time zone,
  constraint bookings_pkey primary key (id),
  constraint bookings_student_id_fkey foreign key (student_id)
    references public.students (id) on delete set null,
  constraint bookings_lesson_type_check check (lesson_type = any (array[
    'beginner'::text, 'advanced'::text, 'clinic'::text,
    'drill_60'::text, 'drill_90'::text, 'play_pro'::text])),
  constraint bookings_status_check check (status = any (array[
    'pending'::text, 'confirmed'::text, 'cancelled'::text, 'no_show'::text])),
  -- Group formats store the quote the student saw; other lessons store none.
  constraint bookings_group_quote_check check (
    case
      when lesson_type = any (array['drill_60'::text, 'drill_90'::text, 'play_pro'::text]) then
        group_size is not null and quoted_per_person_cents is not null
        and quoted_total_cents is not null and group_size >= 1
        and group_size <= case when lesson_type = 'play_pro'::text then 4 else 8 end
        and quoted_per_person_cents > 0
        and quoted_total_cents = quoted_per_person_cents * group_size
      else group_size is null and quoted_per_person_cents is null and quoted_total_cents is null
    end),
  -- No two live lessons overlap in time on the same day.
  constraint bookings_no_overlap exclude using gist (
    lesson_date with =,
    int4range(public.booking_minutes(lesson_time),
              public.booking_minutes(lesson_time) + public.booking_duration(lesson_type)) with &&
  ) where (status <> 'cancelled'::text and status <> 'no_show'::text)
);

create table public.reviews (
  id uuid not null default gen_random_uuid(),
  student_id uuid,
  booking_id uuid,
  rating smallint not null,
  body text,
  display_name text not null,
  lesson_context text,
  tag text,
  takeaway text,
  consent_publish boolean not null,
  verified_booking boolean not null default false,
  source text not null default 'site'::text,
  status text not null default 'pending'::text,
  token_hash text,
  token_used_at timestamp with time zone,
  submitted_ip_hash text,
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint reviews_pkey primary key (id),
  constraint reviews_token_hash_key unique (token_hash),
  constraint reviews_booking_id_fkey foreign key (booking_id)
    references public.bookings (id) on delete set null,
  constraint reviews_student_id_fkey foreign key (student_id)
    references public.students (id) on delete set null,
  constraint reviews_consent_required check (consent_publish),
  constraint reviews_rating_check check (rating >= 1 and rating <= 5),
  constraint reviews_status_check check (status = any (array[
    'pending'::text, 'published'::text, 'hidden'::text]))
);

create table public.inquiries (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  name text not null,
  email text not null,
  message text not null,
  read boolean default false,
  constraint inquiries_pkey primary key (id)
);

create table public.time_slots (
  id uuid not null default gen_random_uuid(),
  display_label text not null,
  sort_key integer not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint time_slots_pkey primary key (id),
  constraint time_slots_display_label_key unique (display_label)
);

create table public.blocked_slots (
  id uuid not null default gen_random_uuid(),
  date date not null,
  "time" text,
  created_at timestamp with time zone default now(),
  all_day boolean not null default false,
  constraint blocked_slots_pkey primary key (id),
  constraint blocked_slots_date_time_key unique (date, "time"),
  constraint blocked_slots_time_required check (all_day = true or "time" is not null)
);

create table public.recurring_blocks (
  id uuid not null default gen_random_uuid(),
  day_of_week integer not null,
  "time" text,
  created_at timestamp with time zone not null default now(),
  constraint recurring_blocks_pkey primary key (id),
  constraint recurring_blocks_day_of_week_check check (day_of_week >= 0 and day_of_week <= 6)
);

create table public.rate_limit_events (
  id bigint generated by default as identity,
  route text not null,
  ip_hash text not null,
  created_at timestamp with time zone not null default now(),
  constraint rate_limit_events_pkey primary key (id)
);

create table public.admin_tasks (
  id uuid not null default gen_random_uuid(),
  title text not null,
  notes text,
  category text,
  due_date date,
  recurrence text not null default 'none'::text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  priority text not null default 'normal'::text,
  constraint admin_tasks_pkey primary key (id),
  constraint admin_tasks_priority_check check (priority = any (array['high'::text, 'normal'::text])),
  constraint admin_tasks_recurrence_check check (recurrence = any (array[
    'none'::text, 'daily'::text, 'weekly'::text, 'biweekly'::text, 'monthly'::text]))
);

create table public.roadmap_checks (
  key text not null,
  checked boolean not null default false,
  updated_at timestamp with time zone default now(),
  constraint roadmap_checks_pkey primary key (key)
);

create index bookings_student_id_idx on public.bookings using btree (student_id);
-- One live booking per date and start time (the overlap constraint covers lengths).
create unique index bookings_unique_active_slot on public.bookings
  using btree (lesson_date, lesson_time) where (status <> 'cancelled'::text);
create index reviews_status_idx on public.reviews using btree (status, published_at desc);
create unique index students_email_key on public.students
  using btree (email_normalized) where (email_normalized is not null);
create unique index students_phone_key on public.students
  using btree (phone_normalized) where (phone_normalized is not null);
create unique index recurring_blocks_unique on public.recurring_blocks
  using btree (day_of_week, coalesce("time", '__ALL_DAY__'::text));
create index rate_limit_events_route_ip_created_idx on public.rate_limit_events
  using btree (route, ip_hash, created_at desc);
create index admin_tasks_category_idx on public.admin_tasks using btree (category);
create index admin_tasks_completed_idx on public.admin_tasks using btree (completed_at);
create index admin_tasks_due_date_idx on public.admin_tasks using btree (due_date);
create index admin_tasks_priority_idx on public.admin_tasks using btree (priority);

-- RLS on everywhere. A role with no policy sees and changes nothing; the
-- server's service role bypasses RLS.
alter table public.students enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.inquiries enable row level security;
alter table public.time_slots enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.recurring_blocks enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.admin_tasks enable row level security;
alter table public.roadmap_checks enable row level security;

-- ---------------------------------------------------------------------------
-- Access (after docs/supabase-least-privilege-migration.sql)
-- ---------------------------------------------------------------------------

-- The public booking widget reads lesson times with the anon key
-- (GET /api/time-slots). Everything else goes through the service role.
create policy "Public select time_slots" on public.time_slots
  for select to public using (true);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.time_slots to anon;

alter function public.booking_minutes(text) set search_path = '';
alter function public.booking_duration(text) set search_path = '';
revoke execute on function public.booking_minutes(text), public.booking_duration(text)
  from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- STRUCTURE CHECK: run on production and on a database built from this file.
-- Both must print the same md5 (2026-10-24: 4d9c6ce0f1481c9f04e02c096de6b63f,
-- 151 lines). If they differ, select the string_agg instead of its md5 on
-- both sides and compare the lines.
-- ---------------------------------------------------------------------------
-- select md5(string_agg(line, E'\n' order by line)) as hash, count(*) as lines from (
--   select format('col %s.%s %s%s%s%s', c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
--          case when a.attnotnull then ' not null' else '' end,
--          coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''),
--          case a.attidentity when 'd' then ' identity' when 'a' then ' identity always' else '' end) as line
--     from pg_attribute a join pg_class c on c.oid = a.attrelid
--     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
--    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
--   union all
--   select format('con %s.%s %s', c.relname, k.conname, pg_get_constraintdef(k.oid))
--     from pg_constraint k join pg_class c on c.oid = k.conrelid
--    where c.relnamespace = 'public'::regnamespace and k.contype in ('p', 'u', 'f', 'c', 'x')
--   union all
--   select format('idx %s', indexdef) from pg_indexes where schemaname = 'public'
--   union all
--   select format('rls %s %s', relname, relrowsecurity) from pg_class
--    where relnamespace = 'public'::regnamespace and relkind = 'r'
--   union all
--   select format('fnsrc %s %s', p.proname, md5(p.prosrc)) from pg_proc p
--    where p.pronamespace = 'public'::regnamespace and p.proname in ('booking_minutes', 'booking_duration')
-- ) s;
