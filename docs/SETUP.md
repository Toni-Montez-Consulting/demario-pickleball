# DeMario Montez Pickleball — Setup & Operations Guide

**Site:** https://demariomontezpb.com  
**Repo:** https://github.com/toniomon96/demario-pickleball  
**Stack:** Next.js 16 · React 19 · TypeScript · Supabase · Vercel · Resend

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Admin Access & Authentication](#3-admin-access--authentication)
4. [Email Setup (Resend)](#4-email-setup-resend)
5. [Supabase Database](#5-supabase-database)
6. [Admin Panel Walkthrough](#6-admin-panel-walkthrough)
7. [Booking Flow](#7-booking-flow)
8. [Deployment](#8-deployment)
9. [Remaining Setup Checklist](#9-remaining-setup-checklist)
10. [Common Operations](#10-common-operations)

---

## 1. Architecture Overview

```
Student visits site
       │
       ▼
demariomontezpb.com  (Vercel — Next.js App Router)
       │
       ├── Public pages: homepage, lessons, contact
       │
       ├── Booking modal → POST /api/bookings → Supabase bookings table
       │                                      → Resend sends confirmation email
       │                                      → Email includes ICS attachment + Google Calendar link
       │
       └── /admin  (protected — requires Supabase Auth + MFA)
              ├── Bookings tab
              ├── Inquiries tab
              ├── Availability tab (time slots, blocked dates, recurring blocks)
              ├── Roadmap page (business checklist)
              └── Tasks page (operational to-dos)
```

**Key services:**
- **Vercel** — hosts the site, stores environment variables, auto-deploys from GitHub on every push to `master`
- **Supabase** — PostgreSQL database + Auth (login/MFA for admin)
- **Resend** — sends transactional emails (booking confirmations, cancellations)

---

## 2. Environment Variables

All variables live in **Vercel → Project → Settings → Environment Variables**.  
They are also in `.env.local` for local development (not committed to git).

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vowwokjesgdjridrikqp.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase admin key (never expose publicly) |
| `NEXT_PUBLIC_SITE_URL` | `https://demariomontezpb.com` | Used in emails and ICS files |
| `ADMIN_EMAIL` | comma-separated list | Controls who can log into the admin panel |
| `RESEND_API_KEY` | `re_...` | Resend API key for sending emails |
| `EMAIL_FROM` | `DeMario Pickleball <bookings@demariomontezpb.com>` | The "from" address on all emails |
| `GOOGLE_CALENDAR_SYNC_ENABLED` | `true` / `false` | Optional. When true, booking availability also checks DeMario's Google Calendar busy times |
| `GOOGLE_CALENDAR_ID` | `primary` or calendar ID | Calendar to read for busy blocks |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth client ID | Google OAuth app client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth client secret | Google OAuth app secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | OAuth refresh token | Token generated after DeMario authorizes calendar free/busy access |

### Adding or updating a variable via CLI

```bash
cd "c:\Users\tonimontez\demario-pickleball-1"

# Add a new variable
echo "your-value-here" | npx vercel env add VARIABLE_NAME production

# Remove and re-add to update a variable
npx vercel env rm VARIABLE_NAME production --yes
echo "new-value" | npx vercel env add VARIABLE_NAME production

# Trigger a redeploy to pick up changes
npx vercel --prod
```

---

### Google Calendar blocking

Use this when DeMario's other lesson platforms already send Google Calendar
invites. The site reads Google Calendar FreeBusy data and treats overlapping
events as unavailable in both the booking picker and final booking API guard.

The only Google scope this app needs is:

```text
https://www.googleapis.com/auth/calendar.freebusy
```

Do not add broader Calendar scopes such as `calendar`, `calendar.readonly`, or
`calendar.events` unless the product actually starts reading or writing event
details.

### Google OAuth production setup

Google OAuth apps created as **External** start in **Testing**. In Testing,
DeMario can authorize the integration as a test user, but the authorization can
expire after 7 days. Before turning calendar blocking on permanently, move the
OAuth app to production and create a fresh refresh token after publishing.

In **Google Cloud Console -> Google Auth Platform / OAuth consent screen**:

1. Confirm the app name clearly matches the site, for example
   `DeMario Montez Pickleball`.
2. Set the user support email to an address you monitor.
3. Add the app home page:
   `https://demariomontezpb.com`
4. Add the privacy policy URL:
   `https://demariomontezpb.com/privacy`
5. Add the terms URL if Google asks for it:
   `https://demariomontezpb.com/terms`
6. Add the authorized domain:
   `demariomontezpb.com`
7. Add only this requested scope:
   `https://www.googleapis.com/auth/calendar.freebusy`
8. Use this scope justification:
   `The site checks DeMario Montez's Google Calendar free/busy availability so students cannot book lesson times that overlap his existing appointments. The app only receives busy time ranges and does not read event titles, notes, locations, attendees, or descriptions.`
9. Save the consent screen and click **Publish app** to move the publishing
   status from Testing to In production.
10. If Google shows an unverified-app warning or asks for verification, continue
    through the verification flow with the same narrow scope and justification.

After the app is published:

1. Have DeMario open his Google Account third-party access page and remove the
   old test authorization for this app if it exists.
2. Re-run OAuth Playground using **Use your own OAuth credentials** with the
   production OAuth client ID and secret.
3. Authorize DeMario's Google account with only:
   `https://www.googleapis.com/auth/calendar.freebusy`
4. Exchange the code for tokens and copy the new refresh token.
5. Replace `GOOGLE_OAUTH_REFRESH_TOKEN` in Vercel production.
6. Set `GOOGLE_CALENDAR_SYNC_ENABLED=true` only after the new token is saved.
7. Redeploy production so the server picks up the new environment values.

### Google Calendar setup

1. In Google Cloud, create or reuse a project and enable **Google Calendar API**.
2. Configure an OAuth consent screen with the
   `https://www.googleapis.com/auth/calendar.freebusy` scope.
3. Create a Web application OAuth client and use OAuth Playground with that
   client ID/secret to authorize DeMario's Google account.
4. Exchange the authorization code for tokens and copy the refresh token.
5. Add these Vercel environment variables:
   - `GOOGLE_CALENDAR_SYNC_ENABLED=true`
   - `GOOGLE_CALENDAR_ID=primary` unless using a secondary calendar ID
   - `GOOGLE_OAUTH_CLIENT_ID=<OAuth client ID>`
   - `GOOGLE_OAUTH_CLIENT_SECRET=<OAuth client secret>`
   - `GOOGLE_OAUTH_REFRESH_TOKEN=<refresh token from DeMario authorization>`
6. Redeploy Vercel after adding the variables.
7. Log into `/admin`, open **Availability**, and confirm the Google Calendar sync
   row says connected for the diagnostic date.
8. Test by adding a Google Calendar event that overlaps a public time slot, then
   open the booking modal and confirm that slot is unavailable.

If Google Calendar sync is enabled but the OAuth values are wrong, the
availability API fails closed instead of showing risky open slots. The refresh
token is a secret; keep it only in Vercel env vars and a password manager.

Important: do not leave the production site dependent on an OAuth app that is
still in **Testing**. Testing is useful for the first proof-of-concept, but the
production site should use an In production OAuth app, a current refresh token,
and the public privacy policy disclosure at `/privacy`.

---

## 3. Admin Access & Authentication

### How it works

1. Admin navigates to `/admin/login` and signs in with email + password
2. Supabase Auth verifies the credentials
3. The site checks that the email is in the `ADMIN_EMAIL` environment variable (comma-separated)
4. If MFA is not yet enrolled, the user is redirected to `/admin/mfa-setup`
5. If MFA is enrolled but not verified in this session, the user is redirected back to login
6. Once both checks pass (`aal2` assurance level), the admin panel loads

This means two things must be true to access admin:
- The account email must be in `ADMIN_EMAIL`
- The account must have MFA enrolled

### Admin accounts

| Email | Role |
|-------|------|
| `demariomontez10@gmail.com` | DeMario — primary admin, receives booking notifications |
| `tonio.montez@gmail.com` | Developer access |
| `tony.montez@gmail.com` | Additional access |
| `ericaxholloway@gmail.com` | Additional access |

### MFA enrollment (one-time per account)

Each person does this once on their own device:

1. Go to `https://demariomontezpb.com/admin/login`
2. Sign in with email and password
3. The site redirects automatically to `/admin/mfa-setup`
4. Open **Google Authenticator** or **Authy** on your phone → tap `+` → **Scan QR code**
5. Scan the QR code shown on screen
6. Type the 6-digit code from the app into the site and confirm
7. Done — every future login requires the 6-digit code

### Adding a new admin account

```bash
# 1. Add their email to the ADMIN_EMAIL list in Vercel
npx vercel env rm ADMIN_EMAIL production --yes
echo "demariomontez10@gmail.com,tonio.montez@gmail.com,newperson@email.com" | npx vercel env add ADMIN_EMAIL production
npx vercel --prod

# 2. Create their Supabase Auth account via the API
curl -X POST "https://vowwokjesgdjridrikqp.supabase.co/auth/v1/invite" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"newperson@email.com"}'

# 3. They accept the invite email, set a password, then enroll MFA as above
```

---

## 4. Email Setup (Resend)

### What emails are sent

| Trigger | Recipient | Contents |
|---------|-----------|----------|
| Student books a lesson | Student | Booking confirmation, lesson details, payment link, ICS calendar attachment, Google Calendar button |
| Student books a lesson | `demariomontez10@gmail.com` | New booking notification with student info and link to admin dashboard |
| Admin cancels a booking | Student | Cancellation notice with ICS cancel attachment (removes event from calendar) |

### ICS calendar attachment

Every student confirmation email includes an `.ics` file. When the student opens it:
- **Apple Mail / Outlook** — adds to Calendar automatically
- **Gmail desktop** — shows an "Add to Calendar" button
- **Gmail mobile** — may not render the attachment; use the **"Add to Google Calendar"** button in the email body instead

The ICS file is generated server-side with the correct America/Chicago timezone, lesson duration, location, and booking ID.

### Setting up Resend (if not done)

**Step 1 — Get your API key**
1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Click **Create API Key** → name it `demario-pickleball` → permission: **Sending access** → **Add**
3. Copy the key (starts with `re_` — only shown once)
4. Run:
```bash
echo "re_YOUR_KEY_HERE" | npx vercel env add RESEND_API_KEY production
npx vercel --prod
```

**Step 2 — Verify your sending domain**
1. Go to [resend.com/domains](https://resend.com/domains) → **Add Domain** → enter `demariomontezpb.com`
2. Resend shows 3 DNS records. Add all of them to your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.):

| Type | Name | Value |
|------|------|-------|
| TXT | `resend._domainkey` | DKIM signature (long string) |
| MX | `send` | SES feedback endpoint |
| TXT | `send` | SPF record |

3. Back in Resend, click **Verify DNS Records** — takes 5–30 minutes
4. Once verified, update `EMAIL_FROM`:
```bash
npx vercel env rm EMAIL_FROM production --yes
echo "DeMario Pickleball <bookings@demariomontezpb.com>" | npx vercel env add EMAIL_FROM production
npx vercel --prod
```

> **Temporary:** Until domain is verified, `EMAIL_FROM` is set to `onboarding@resend.dev`. Emails still send but show Resend's address as the sender.

---

## 5. Supabase Database

**Project:** Mario Pickleball  
**Project ID:** `vowwokjesgdjridrikqp`  
**Dashboard:** https://supabase.com/dashboard/project/vowwokjesgdjridrikqp

### Tables

| Table | Purpose |
|-------|---------|
| `bookings` | Every lesson booking — name, email, date, time, type, status, paid_at |
| `time_slots` | The times students can pick in the booking modal — managed from admin Availability tab |
| `blocked_slots` | One-off date/time blocks — e.g. "block Nov 15 all day" |
| `recurring_blocks` | Weekly recurring blocks — e.g. "no lessons every Tuesday" |
| `inquiries` | Contact form submissions |
| `roadmap_checks` | Persists checkbox state for the business roadmap page |

### Booking uniqueness

A partial unique index prevents double-booking:
```sql
bookings_unique_active_slot ON bookings(lesson_date, lesson_time) WHERE status != 'cancelled'
```
If two students try to book the same slot simultaneously, one gets a 409 error and the booking modal refreshes availability automatically.

### Row Level Security

All tables use RLS. Public browser reads use the anon key only for non-PII schedule data. Public form submissions go through Next.js API routes, which validate input and then use the service role from trusted server code. Admin routes require Supabase Auth, an allowed admin email, MFA, and then use the service role for data operations. The service role key is never exposed to the browser.

### Abuse protection

Run `docs/supabase-p1-hardening.sql` to create the `rate_limit_events` table used by public booking and inquiry rate limits. The app stores hashed IP identifiers only, and rate limiting fails open if the table is unavailable.

---

## 6. Admin Panel Walkthrough

### Bookings tab

- Shows all bookings sorted by date
- **Confirm** — marks the booking confirmed (no email sent)
- **Cancel** — marks cancelled and sends a cancellation email to the student with an ICS cancel file that removes the event from their calendar
- **Mark paid** — toggles the paid_at timestamp; shows a checkmark when paid

### Inquiries tab

- Shows all contact form submissions
- **Mark read / Mark unread** — tracks which messages you've seen

### Availability tab

**Time slots** — the times shown in the booking modal. Add a slot (e.g. `9:00 AM`), and it appears immediately. Hide a slot to remove it from public view without deleting it.

**Recurring unavailability** — block an entire day of the week every week (e.g. no lessons on Sundays), or a specific time every week.

**One-off blocks** — block a specific date. Check "Whole day" to block all times, or pick a specific time slot to block just that time on that date.

> The booking API checks all three layers (time_slots active, not in blocked_slots, not in recurring_blocks) before allowing a booking.

### Roadmap page (`/admin/roadmap`)

A private business checklist covering:
- Phase 0: Legal & Financial Foundation (LLC, EIN, business bank account, insurance, taxes)
- Phase 1: Digital Presence (Google Business, DUPR API/partner access, Instagram, TikTok, email list)
- Phase 2: Booking & Payments (Stripe, packages, cancellation policy)
- Phase 3: Revenue Diversification (clinics, content, referrals, gift cards)
- Phase 4: Systems & Business Health (P&L review, quarterly taxes, second coach)
- Phase 5: Long-term Growth (video course, sponsorship, coaching team)

Checkbox state is saved to Supabase (`roadmap_checks` table) so it persists across devices.

The DUPR API item is a manual access step first. DUPR's current public docs show
public APIs that require external read-only tokens, while broader integrations
are handled through DUPR support/API partner paths. Once DeMario has approved
access, the site can add a small server-side sync to refresh verified singles
and doubles ratings instead of hardcoding them.

---

## 7. Booking Flow

1. Student clicks **Book a Lesson** anywhere on the site
2. Modal opens → Step 1: fill in name, email, phone (optional), lesson type, agree to terms
3. Step 2: pick a date (next 30 days shown), pick a time slot
   - Unavailable times are grayed out (already booked, blocked by admin, or recurring block)
   - If a date is fully blocked by admin, a message shows instead of the time grid
4. Student clicks **Confirm** → API call to `POST /api/bookings`
5. Server validates: time slot exists and is active, slot not blocked, slot not already booked
6. If valid: booking is inserted → confirmation emails sent (student + DeMario)
7. If slot was just taken by someone else (race condition): student sees "That time was just taken" and the time grid refreshes
8. After confirmation: student sees booking summary + payment options (Cash App, Zelle, PayPal QR)

---

## 8. Deployment

**Auto-deploy:** Every push to `master` on GitHub triggers a Vercel production deployment automatically. No manual deploy needed for code changes.

**Manual redeploy** (needed after adding/changing env vars):
```bash
npx vercel --prod
```

**Check deployment status:**
```bash
npx vercel ls
```

**View deployment logs:**
```bash
npx vercel logs <deployment-url>
```

### Local development

```bash
cd "c:\Users\tonimontez\demario-pickleball-1"
npm install
npm run dev
# Site runs at http://localhost:3000
```

Requires a `.env.local` file with all variables listed in Section 2.

---

## 9. Remaining Setup Checklist

- [ ] **Add RESEND_API_KEY** — emails don't send without this (see Section 4)
- [ ] **Verify domain in Resend** — so emails come from `bookings@demariomontezpb.com` (see Section 4)
- [ ] **Update EMAIL_FROM** after domain verified (see Section 4)
- [ ] **Enroll MFA** for each admin account (see Section 3) — nobody can access the admin panel until their account has MFA set up
  - [ ] `tonio.montez@gmail.com`
  - [ ] `demariomontez10@gmail.com`
  - [ ] `tony.montez@gmail.com`
  - [ ] `ericaxholloway@gmail.com`
- [ ] **Add time slots** — go to Admin → Availability → Time slots → add the times you offer lessons (e.g. `9:00 AM`, `10:00 AM`, etc.) — students can't book until at least one slot exists
- [ ] **Publish Google OAuth app to production** before leaving Google Calendar blocking enabled long-term (see Google Calendar blocking)
- [ ] **Generate a fresh DeMario Google OAuth refresh token** after publishing, then update Vercel and redeploy

---

## 10. Common Operations

### Add a time slot
Admin → Availability tab → Time slots section → type the time (e.g. `2:00 PM`) → **Add slot**

### Block a date
Admin → Availability tab → One-off blocks section → pick a date → pick a time or check "Whole day" → **Block**

### Cancel a booking
Admin → Bookings tab → find the booking → **Cancel** — this automatically sends a cancellation email to the student

### Mark a booking paid
Admin → Bookings tab → click **Mark paid** on the booking row — shows a checkmark with the payment date

### Change who has admin access
Update `ADMIN_EMAIL` in Vercel (comma-separated list), redeploy, and create/remove their Supabase Auth account.

### Rotate the Resend API key
1. Create a new key at resend.com/api-keys
2. Run:
```bash
npx vercel env rm RESEND_API_KEY production --yes
echo "re_NEW_KEY" | npx vercel env add RESEND_API_KEY production
npx vercel --prod
```
3. Delete the old key in Resend dashboard

### Check if emails are sending
Go to [resend.com/emails](https://resend.com/emails) — every sent email appears here with delivery status and full content preview.
