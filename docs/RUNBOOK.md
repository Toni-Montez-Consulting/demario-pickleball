# Runbook

What to do when something on demariomontezpb.com breaks. Each section starts with what
you see. It is written for Tonio and for a second person with the same access; the
setup details it points to are in `docs/SETUP.md`.

**Access it needs:** the Vercel team (project `demario-pickleball`), the Supabase
organization (project `vowwokjesgdjridrikqp`), the GitHub repository
`Toni-Montez-Consulting/demario-pickleball`, and the Resend account. As of 2026-10-24 only
Tonio holds all four, and only Tonio receives the health-check emails (GitHub sends a failed
scheduled run to whoever last edited its schedule). Billing contacts and cards are in the
owner's private notes, not in this public repository.

## First two minutes

1. Open <https://demariomontezpb.com> on a phone and start a booking as far as the time picker.
2. GitHub → Actions → **Site health** → the latest run. Its log names the failed check:
   homepage, lesson times (database), availability (Google Calendar), calendar sync switched
   on, or published reviews. **Run workflow** re-checks now; it also runs every hour at :17.
3. Vercel → demario-pickleball → **Logs**, or
   `vercel logs --environment production --status-code 5xx --since 30m`. Runtime logs are
   kept for one day on this plan, so look the same day.

## The site broke after a deploy

Roll back first, fix second.

1. Vercel → demario-pickleball → the **Production Deployment** tile → **Instant Rollback**.
   Pick the last good deployment (**Choose another deployment** lists every earlier one),
   then **Continue** and **Confirm Rollback**. It takes effect at once. From the CLI:
   `vercel rollback <deployment-url>`.
2. While rolled back, Vercel does not put new merges live: a fix merged to `master` builds
   but stays unpublished.
3. When the fix's deployment is ready, click **Undo Rollback** on the same tile and pick it
   (CLI: `vercel promote <deployment-url>`). New merges then go live on their own again.
4. A rollback serves the old build with the environment variables it was built with. If a
   changed variable caused the break, change it back and redeploy instead.

Source: vercel.com/docs/instant-rollback, read 2026-10-24.

## Students cannot book

The booking dialog says "Could not load availability", or shows no lesson times. The Site
health log says which part failed:

- **lesson times (database)** or **published reviews:** the site cannot read its database.
  Check status.supabase.com and the Supabase project page. If a `docs/supabase-*.sql`
  migration was applied just before, run its undo file if it has one (for example
  `docs/supabase-least-privilege-undo.sql`), then find what needed the access.
- **availability (Google Calendar):** Google refused the calendar check, usually because
  DeMario's authorization expired or was removed. The booking dialog then says it could not
  load availability, so nobody double-books, but nobody books either. Reconnect with "Google OAuth production
  setup" in `docs/SETUP.md`: DeMario approves, the new refresh token goes into Vercel, then
  redeploy. To take bookings while waiting, set `GOOGLE_CALENDAR_SYNC_ENABLED` to `false` and
  redeploy. Times then show without checking his calendar, so tell DeMario to watch for
  overlaps, and expect the calendar sync check to fail every hour until it is back on.
- **calendar sync switched on:** `GOOGLE_CALENDAR_SYNC_ENABLED` in Vercel is not exactly
  `true`, so his other lessons show as open times. Fix the value and redeploy.

A changed Vercel variable takes effect only after a redeploy (`docs/SETUP.md`, section 2).

## Emails stop arriving

Bookings still save when an email fails, and they show in Admin → Bookings.

1. Resend → **Emails**: look for failed or bounced sends and their reasons.
2. Resend → **Domains**: `demariomontezpb.com` must read verified. Its DNS records are in
   Vercel → Domains; do not delete them.
3. Vercel: `RESEND_API_KEY` must be set for Production. After changing it, redeploy.

## A daily email did not go out

Four daily jobs run from `vercel.json`, in UTC: lesson outcomes 13:00, the Tomorrow email
14:00, review requests 15:00, lesson reminders 23:00. In Dallas that is 8 AM, 9 AM, 10 AM,
and 6 PM in summer, an hour earlier in winter. Vercel does not retry a failed run and can
occasionally start one twice.

- Check the runs in Vercel → demario-pickleball → Logs, filtered by the job's path.
- Run one by hand: `vercel crons run /api/cron/lesson-reminders` (likewise
  `/api/cron/coach-tomorrow`, `/api/cron/review-requests`, `/api/cron/lesson-outcomes`).
- The reminder and review-request jobs mark each booking before emailing, so a second run
  never emails a student twice. A second Tomorrow email or outcome digest to DeMario is
  possible and harmless.

## Data was lost or damaged

Supabase Pro keeps a daily backup for 7 days (supabase.com/docs/guides/platform/backups,
read 2026-10-24).

1. Stop the damage first: roll back a bad deploy, or turn off the job causing it.
2. Supabase → **Database** → **Backups** → scheduled backups. Restore the latest backup from
   before the damage.
3. The project is offline during the restore, and everything written after that backup is
   lost, including any admin account or MFA change. Re-enter bookings made since then from
   the booking emails in DeMario's inbox.

No restore has been run on this project yet. To practice without touching production,
restore a backup into a new project ("Restore to a new project" in the same Supabase docs)
and compare it with `docs/schema.sql` using the STRUCTURE CHECK at the end of that file.

## A secret leaked

Change it where it is issued, update Vercel Production, then redeploy. What each change
breaks:

| Variable | Change it in | What stops working |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys | The legacy key cannot be rotated (Supabase docs, read 2026-10-24). Move the site to a new secret key, then disable the legacy keys there |
| `RESEND_API_KEY` | Resend → API Keys: create a new key, then delete the old one | Email, until Vercel has the new key |
| `LESSON_OUTCOME_SECRET` | Vercel only (any long random value) | Every one-tap link already emailed: lesson outcome (14 days), review publish or take-down (60 days), Cancel (45 days) |
| `RATE_LIMIT_SALT` | Vercel only | Every review link already emailed to a student, and the rate-limit history. Change it only if it leaked |
| `CRON_SECRET` | Vercel only | Nothing: Vercel sends the new value to the jobs after the redeploy |
| `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` | Google Cloud, then re-authorize (`docs/SETUP.md`) | Lesson times, until the new token is in Vercel |
| An admin's password or MFA | Supabase → Authentication → Users | That admin signs in again |

Review links are hashed with `RATE_LIMIT_SALT`, and with the service role key when the salt
is missing. Keep the salt set, so a new service role key never voids review links.

## Domain and renewals

- `demariomontezpb.com` is registered at Vercel with auto-renew; the current term ends
  2027-04-24.
- Its DNS lives in Vercel → Domains: the Resend email records (DKIM, and SPF on the `send.`
  subdomain) and the CAA records.
