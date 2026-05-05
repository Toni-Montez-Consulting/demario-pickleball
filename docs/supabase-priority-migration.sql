-- Admin tasks priority column migration.
-- Run in Supabase SQL Editor (Project > SQL Editor > New query).

alter table public.admin_tasks
  add column if not exists priority text not null default 'normal'
  check (priority in ('high', 'normal'));

create index if not exists admin_tasks_priority_idx on public.admin_tasks (priority);
