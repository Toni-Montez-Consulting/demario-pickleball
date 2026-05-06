# DeMario Montez Pickleball Coaching — Application Overview

This document is the canonical technical and product reference for `demariomontezpb.com`.
It describes what the application does, how it is built, how each piece fits together, and what exists where in the codebase.

---

## 1. Purpose and Context

This is the professional coaching website for **DeMario Montez**, a Dallas–Fort Worth pickleball coach (4.70 doubles DUPR, USTA certified, Top 3% TeachMe.To SuperCoach). The site has two audiences:

- **Students** — discover DeMario's credentials and coaching style, understand lesson options and pricing, and self-schedule a lesson time directly through the site.
- **DeMario (admin)** — manage bookings, block unavailable times, reply to inquiries, track business tasks and roadmap items, and monitor site health.

The business operates at the intersection of two booking channels: times that students can book directly through the site (outdoor public courts), and times that require the student to go through a venue platform first (PodPlay for Dallas Indoor/The Grove, Life Time's own system, TeachMe.To, Impact Activities for Samuel-Grand). The site enforces this routing rather than acting as a unified booking engine for all venues.

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Turbopack in development |
| Language | TypeScript 5 | Strict mode, `tsc --noEmit` in CI |
| Styling | CSS modules + global stylesheet | `globals.css`, no Tailwind |
| Database & Auth | Supabase | Row-Level Security, MFA-gated admin |
| Email | Resend | Transactional emails + ICS attachments |
| Calendar | Google Calendar API | OAuth 2.0 refresh-token flow |
| Error Monitoring | Sentry | Server, client, and edge configs |
| Unit Tests | Vitest 4 | jsdom environment, no parallelism |
| E2E Tests | Playwright | Smoke suite covers public + admin flows |
| Fonts | Google Fonts (Inter + Space Grotesk) | Loaded via `next/font` |
| Deployment | Vercel (implied by Next.js config) | `NEXT_PUBLIC_SITE_URL` configures the base |

**CI pipeline (`npm run ci`):** `typecheck → lint → test → build`

---

## 3. Repository Layout

```
demario-pickleball-1/
├── src/
│   ├── app/                  Next.js App Router pages and API routes
│   │   ├── page.tsx          Public homepage (single-page layout)
│   │   ├── layout.tsx        Root layout: metadata, fonts, JSON-LD, Sentry
│   │   ├── globals.css       Global styles
│   │   ├── admin/            Admin shell + dashboard (auth-gated)
│   │   ├── api/              Server-side API route handlers
│   │   ├── auth/callback/    Supabase OAuth callback
│   │   ├── pay/              Payment instructions page
│   │   ├── privacy/          Privacy policy page
│   │   └── terms/            Terms of service page
│   ├── components/           React client components
│   ├── lib/                  Shared business logic, utilities, and integrations
│   ├── instrumentation.ts    Sentry server-side setup entry
│   ├── instrumentation-client.ts  Sentry client-side setup entry
│   ├── sentry.server.config.ts
│   └── sentry.edge.config.ts
├── docs/                     All project documentation
├── e2e/                      Playwright end-to-end test specs
├── scripts/                  PowerShell launch/config helpers
├── public/img/               Static images served at /img/
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

---

## 4. Public-Facing Site

The homepage (`src/app/page.tsx`) is a client component that assembles the full marketing experience as a single scrollable page. All sections are imported from `src/components/`.

### Sections (in render order)

| Component | Role |
|---|---|
| `Nav` | Fixed top navigation bar with a "Book a Lesson" CTA |
| `Hero` | Above-the-fold splash with headline and primary CTA |
| `TrustBar` | Credential badges (DUPR rating, USTA cert, SuperCoach rank) |
| `Testimonials` | Student review cards sourced from `src/lib/data.ts` |
| `ImproveGrid` | Visual grid showing areas of coaching focus |
| `Philosophy` | DeMario's coaching philosophy prose section |
| `Lessons` | Three lesson types with pricing, structure, and individual CTAs |
| `WhereWeTrain` | Venue routing section explaining court options |
| `About` | DeMario's background and credentials |
| `FinalCta` | Bottom-of-page call-to-action |
| `BookingPlatforms` | Cards for platform-required venues (PodPlay, Life Time, TeachMe.To) |
| `ContactForm` | Public inquiry / contact form |
| `Footer` | Links to privacy, terms, social, and site info |
| `StickyCta` | Mobile-optimized sticky booking button |
| `BookingModal` | Full multi-step booking flow (see §6) |
| `CookieBanner` | Cookie consent notice |

### Lesson Types and Pricing

All lesson data lives in `src/lib/data.ts` and `src/lib/business.ts`.

| Key | Name | Price | Duration |
|---|---|---|---|
| `beginner` | Foundations | $70 | 60 min |
| `advanced` | Strategy Lab | $80 | 75 min |
| `clinic` | Group Clinic | $50/player | 90 min |

---

## 5. Venue Routing Logic

The business operates across multiple venues, each with a different booking owner. The routing rules are codified in two places:

- **`src/lib/venue-rules.ts`** — TypeScript constants for each venue: name, booking mode, payment owner, waiver owner, student action, CTA label, and external link.
- **`docs/VENUE_RULES.md`** — Plain-language matrix and the add-a-court checklist for DeMario and Tonio.

**Booking modes:**

| Mode | Meaning |
|---|---|
| `site-direct` | Student books directly via the site. Mario confirms the exact court. |
| `platform-required` | Student must go to an external platform (PodPlay, Life Time, TeachMe.To) first. The site shows routing cards, not a time picker. |
| `hybrid-by-request` | Student contacts Mario to arrange (Samuel-Grand / Impact). |

**Enforced in the API:** the `POST /api/bookings` handler rejects submissions that attempt to bypass indoor routing. If the court preference indicates an indoor/platform-required venue, the booking is rejected server-side with a 400 so the student cannot circumvent the modal flow.

---

## 6. Booking Flow (Student)

The booking modal (`src/components/BookingModal.tsx`) is a multi-step state machine.

```
form → (outdoor) → picker → loading → confirmed
     → (indoor)  → indoorRouting   (exits site to platform)
     → (any)     → terms  → picker → ...
```

### Steps

1. **Form** — Student fills in name, email, phone (required), lesson type, and court setup preference (outdoor / indoor / help me choose).
2. **Indoor Routing** — If indoor or unknown is selected, the modal shows venue route cards. Each card links to the correct external platform. The booking flow stops here for platform-required venues.
3. **Terms** — Student reads and accepts the waiver and cancellation terms before seeing the time picker.
4. **Picker** — A date strip showing the next 30 days with slots loaded from `GET /api/availability?date=YYYY-MM-DD`. Slots already booked, blocked by the admin, in Google Calendar, or outside configured time-slot windows are hidden.
5. **Loading** — `POST /api/bookings` is called.
6. **Confirmed** — Displays booking ID, lesson details, court confirmation message, and payment instructions.

---

## 7. API Routes

All routes live under `src/app/api/`. Each folder contains a `route.ts` file (Next.js App Router convention).

### Public Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/bookings` | POST | Create a new booking. Validates input, checks slot availability, enforces indoor routing, stores to Supabase, sends confirmation emails. |
| `/api/availability` | GET | Returns available and unavailable time slots for a date. Merges bookings, blocked slots, recurring blocks, time-slot config, and Google Calendar free/busy. |
| `/api/inquiries` | POST | Submits a contact form message. Validates honeypot, rate-limits by IP, stores to Supabase, sends notification to DeMario. |
| `/api/feedback` | POST | Collects post-lesson feedback. |

### Admin-Only Routes

All admin routes require a valid Supabase session at AAL2 (MFA-verified). The middleware checks both session validity and that the email is in the `ADMIN_EMAIL` allowlist.

| Route | Methods | Purpose |
|---|---|---|
| `/api/bookings` | GET, PATCH | List all bookings; update status (confirm, cancel, mark paid). |
| `/api/blocked-slots` | GET, POST, DELETE | Manage one-off blocked dates and times. |
| `/api/recurring-blocks` | GET, POST, DELETE | Manage weekly recurring unavailability (e.g., every Monday). |
| `/api/time-slots` | GET, POST, PATCH, DELETE | Manage the master list of bookable lesson times. |
| `/api/calendar-sync` | GET | Returns Google Calendar sync status and recent free/busy check for admin diagnostics. |
| `/api/tasks` | GET, POST, PATCH, DELETE | Admin task list (short-term action items). |
| `/api/roadmap` | GET, POST, PATCH, DELETE | Business roadmap items (longer-horizon milestones). |
| `/api/monitoring-test` | POST | Triggers a test Sentry error for production monitoring verification. |

---

## 8. Availability Engine

**`src/lib/availability.ts`** is the core of the scheduling system. It is called by both the public availability API and the booking creation API.

### Layers of availability (all resolved per-date)

1. **Time slots** — The master list of lesson times DeMario is willing to teach (e.g., `10:00 AM`, `2:00 PM`). Managed in Admin → Availability. A slot must be `active = true` to appear.
2. **Existing bookings** — Any non-cancelled booking for the date removes that slot.
3. **Blocked slots** — Admin-set one-off blocks remove individual times or mark an entire day unavailable.
4. **Recurring blocks** — Day-of-week patterns (e.g., every Sunday) remove matching slots every week.
5. **Google Calendar free/busy** — When the integration is configured and enabled, any overlapping calendar event hides the slot. Duration is determined by lesson type so a 75-minute Strategy Lab can block a different range than a 60-minute Foundations lesson.

### Booking window

Public students can only book dates that are:
- At least 1 day in the future (no same-day bookings)
- No more than 30 days in the future

The booking window is enforced on both the front-end date strip and the API.

---

## 9. Admin Dashboard

The admin area lives at `/admin` and is protected at two levels:

1. **Supabase session** — The Supabase middleware (`src/lib/supabase/server.ts`) verifies the cookie session on every admin request.
2. **AAL2 (MFA)** — Admin API routes additionally check that the session assurance level is `aal2`, meaning the user has completed a second-factor challenge. The MFA setup flow is at `/admin/mfa-setup`.
3. **Email allowlist** — The `ADMIN_EMAIL` environment variable holds the comma-separated list of permitted admin email addresses.

### Dashboard Sections

| Section | File | Purpose |
|---|---|---|
| Bookings | `AdminDashboard.tsx` | View all bookings, filter by week, confirm/cancel/mark-paid, one-tap text/call student |
| Inquiries | `AdminDashboard.tsx` | Read and mark-read contact form submissions |
| Availability | `AvailabilityCalendar.tsx` + `WeeklyTemplateEditor.tsx` | Manage time slots, blocked dates, recurring blocks, and Google Calendar sync status |
| Tasks | `/admin/(protected)/tasks/` + `TasksDashboard.tsx` | Short-term action items (add, complete, delete) |
| Business Roadmap | `/admin/(protected)/roadmap/` + `RoadmapDashboard.tsx` | Longer-horizon milestones for the coaching business |
| Site Roadmap | `/admin/(protected)/site-roadmap/` + `SiteRoadmapDashboard.tsx` | Developer-facing technical roadmap items |

---

## 10. Email System

**Provider:** Resend (`resend` npm package)

**Entry point:** `src/lib/email/client.ts` — creates and exports the Resend client using the `RESEND_API_KEY` environment variable.

**Templates:** `src/lib/email/templates.ts` — HTML email templates for:
- Student booking request confirmation (with ICS calendar attachment, payment instructions, and court confirmation note)
- Admin booking notification (with student phone, lesson type, court preference, and booking ID)
- Booking cancellation (student and admin copies)
- Inquiry notification (to DeMario)

**ICS generation:** `src/lib/email/ics.ts` — generates RFC 5545-compliant `.ics` calendar event attachments. Attached to student-facing booking emails so they can add the lesson to their calendar app.

---

## 11. Google Calendar Integration

**Module:** `src/lib/google-calendar.ts`

Uses OAuth 2.0 with a long-lived refresh token to call the Google Calendar FreeBusy API. The integration is intentionally **read-only** — it only asks whether DeMario is busy during a given window. It does not create calendar events.

### Configuration (environment variables)

| Variable | Purpose |
|---|---|
| `GOOGLE_CALENDAR_SYNC_ENABLED` | Must be `"true"` to activate the integration |
| `GOOGLE_CALENDAR_ID` | The calendar to query (usually DeMario's primary Gmail calendar) |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud OAuth 2.0 client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud OAuth 2.0 client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Long-lived refresh token from the OAuth consent flow |

Access tokens are cached in memory with a 60-second safety margin before expiry to reduce token-refresh calls.

---

## 12. Security Model

### Rate Limiting

**Module:** `src/lib/rate-limit.ts`

Supabase-backed IP-based rate limiting applied to public POST endpoints (`/api/bookings`, `/api/inquiries`). The client IP is hashed (SHA-256 + salt) before storage so no raw IPs are persisted. The `rate_limit_events` table in Supabase stores hashed IP + route + timestamp. Window counts are checked before each request.

### Honeypot Fields

The contact form and booking form include hidden honeypot input fields. If a submission includes a value in the honeypot field, the request is silently rejected at the API layer.

### Admin Auth / MFA

Admin routes require both an active Supabase session and AAL2 assurance (TOTP second factor). This is enforced server-side on all admin API routes. The `/admin/mfa-setup` page walks new admins through TOTP enrollment.

### Input Validation

All public API inputs are validated server-side before any database interaction:
- Date strings are validated with a strict regex plus `Date` parse verification
- Email addresses and phone numbers are checked against RFC-compliant regexes
- Booking date is checked to fall within the 30-day public window
- Lesson types are restricted to the known enum set
- Indoor routing bypass attempts are rejected with HTTP 400

### Supabase RLS

Row-Level Security policies on `bookings`, `inquiries`, and `rate_limit_events` prevent anonymous Supabase clients from reading or writing those tables directly. All public mutations go through the Next.js API routes using a service-role key that is never exposed to the browser.

---

## 13. Monitoring

**Provider:** Sentry (`@sentry/nextjs`)

Instrumentation is loaded via Next.js instrumentation hooks:
- `src/instrumentation.ts` — server-side Sentry init
- `src/instrumentation-client.ts` — browser Sentry init
- `src/sentry.edge.config.ts` — edge runtime Sentry init
- `src/app/global-error.tsx` — catches unhandled React render errors

The `/api/monitoring-test` endpoint (admin-only) triggers a synthetic Sentry error to verify that the DSN, environment, and alert routing are configured correctly in production.

---

## 14. SEO and Structured Data

The root layout (`src/app/layout.tsx`) sets:
- `<title>` and `<meta description>` for search engines
- Open Graph and Twitter Card tags for social sharing
- `schema.org/LocalBusiness` JSON-LD structured data with address, phone, email, geo coordinates, and `@type: SportsActivityLocation`
- `schema.org/Person` JSON-LD for DeMario as a coach
- `robots.ts` and `sitemap.ts` in `src/app/` for crawlers

---

## 15. Database Schema (Supabase / PostgreSQL)

The production Supabase project uses the following core tables. Schema changes are managed via the SQL migration files in `docs/`.

| Table | Purpose |
|---|---|
| `bookings` | One row per booking. Fields: id, name, email, phone, lesson_type, lesson_date, lesson_time, status, notes, paid_at, created_at |
| `inquiries` | One row per contact form submission. Fields: id, name, email, message, read, created_at |
| `blocked_slots` | One-off blocked dates/times set by admin. Fields: id, date, time (nullable for all-day), all_day, created_at |
| `recurring_blocks` | Weekly recurring unavailability. Fields: id, day_of_week (0–6), time (nullable), created_at |
| `time_slots` | The bookable lesson times. Fields: id, display_label, sort_key, active |
| `rate_limit_events` | IP-hash + route + timestamp rows used for rate limiting. Rows older than the window are ignored. |

**Key constraints (applied by `docs/supabase-p1-hardening.sql`):**
- `bookings_unique_active_slot` — unique partial index on `(lesson_date, lesson_time)` where `status != 'cancelled'`, preventing double-booking at the database level.

**Migrations to run in order:**
1. `docs/supabase-p0-migration.sql` — adds waiver columns, tightens public PII policy
2. `docs/supabase-p1-hardening.sql` — adds the unique slot constraint and rate_limit_events table

---

## 16. Testing

### Unit Tests (Vitest)

Run with `npm run test`. Tests run sequentially (`--no-file-parallelism`) to avoid Supabase client conflicts.

| File | What it tests |
|---|---|
| `src/lib/availability.test.ts` | Availability logic: date validation, booking window, slot filtering, Google Calendar busy overlap |
| `src/lib/booking-notes.test.ts` | Court preference serialization and parsing |
| `src/lib/data.test.ts` | Lesson data shape validation |
| `src/lib/rate-limit.test.ts` | IP hashing and rate-limit window logic |
| `src/lib/tasks.test.ts` | Task list data operations |
| `src/lib/google-calendar.test.ts` | Calendar free/busy parsing |
| `src/lib/email/ics.test.ts` | ICS event generation |
| `src/lib/email/templates.test.ts` | Email template rendering |
| `src/app/admin/AdminDashboard.test.tsx` | Admin dashboard render and interaction |
| `src/components/BookingModal.test.tsx` | Booking modal step transitions |

### E2E Tests (Playwright)

Run with `npm run test:e2e`. The smoke suite in `e2e/smoke.spec.ts` covers:
- Homepage renders correctly
- Booking modal opens and steps through form
- Payment options page
- Contact form submission
- Admin login page gating (redirects unauthenticated users)

---

## 17. Environment Variables

All required variables must be set in Vercel (or `.env.local` for local development). Never commit `.env.local` to the repository.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical site URL (e.g., `https://demariomontezpb.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key for browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key for server-side API routes |
| `RESEND_API_KEY` | Yes | Resend API key for transactional email |
| `ADMIN_EMAIL` | Yes | Comma-separated list of allowed admin email addresses |
| `RATE_LIMIT_SALT` | Yes | Salt for IP hashing in rate limiter |
| `GOOGLE_CALENDAR_SYNC_ENABLED` | Optional | Set to `"true"` to enable Calendar free/busy blocking |
| `GOOGLE_CALENDAR_ID` | Optional | Gmail calendar ID to query |
| `GOOGLE_OAUTH_CLIENT_ID` | Optional | Google Cloud OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Optional | Google Cloud OAuth client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Optional | Long-lived OAuth refresh token |
| `NEXT_PUBLIC_LESSON_LOCATION` | Optional | Fallback location text shown in emails when court not yet confirmed |
| `SENTRY_DSN` | Optional | Sentry DSN for error reporting |
| `SENTRY_AUTH_TOKEN` | Optional | Sentry auth token for source map uploads |

---

## 18. Deployment Checklist (Summary)

Before going live with a new environment, see `docs/RELEASE_CHECKLIST.md` for the full sequence. Key steps:

1. Run both Supabase migration SQL files in the Supabase SQL Editor.
2. Verify `bookings_unique_active_slot` constraint exists.
3. Verify RLS blocks anon reads/writes on `bookings`, `inquiries`, `rate_limit_events`.
4. Set all required environment variables in Vercel.
5. Complete Google Calendar OAuth flow and confirm Admin → Availability shows "connected."
6. Configure time slots in Admin → Availability.
7. Verify Sentry receives a test event from `/api/monitoring-test`.
8. Run `npm run ci` locally (typecheck, lint, unit tests, build all pass).
9. Run `npm run test:e2e` to confirm Playwright smoke suite passes.

---

## 19. Key Documents in `docs/`

| File | Audience | Purpose |
|---|---|---|
| `APP_OVERVIEW.md` | Everyone | This document |
| `DEVELOPER_PLAN.md` | Tonio | Code/ops status, shipped work, deferred roadmap |
| `MARIO_ACTION_PLAN.md` | DeMario | Plain-language checklist of owner tasks |
| `ADMIN_HANDOFF.md` | DeMario | Daily operating guide for the admin dashboard |
| `RELEASE_CHECKLIST.md` | Both | Pre-launch and pre-promotion manual verification steps |
| `VENUE_RULES.md` | Both | Venue routing matrix and add-a-court checklist |
| `DEPENDENCY_ADVISORIES.md` | Tonio | Tracked npm advisory notes, deferred upgrades |
| `LAUNCH_OUTSTANDING.md` | Both | Open gates before broader promotion |
| `PLAYBOOK.md` | Tonio | Portfolio playbook links |
| `SETUP.md` | Tonio | Local development setup instructions |
| `supabase-p0-migration.sql` | Tonio | Run once in production Supabase SQL editor |
| `supabase-p1-hardening.sql` | Tonio | Run once in production Supabase SQL editor |
