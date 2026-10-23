-- Day-before lesson reminders (feat/lesson-reminders).
--
-- One nullable column. The reminder cron stamps it before sending ("claim
-- first"), so a run Vercel starts twice cannot email a student twice. Existing
-- rows stay null, and nothing else reads the column.
--
-- Apply BEFORE merging the PR: once the cron is deployed, it queries this
-- column every morning and answers 500 until it exists.

alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

-- VERIFY (expect one row: reminder_sent_at | timestamp with time zone | YES)
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'bookings' and column_name = 'reminder_sent_at';
