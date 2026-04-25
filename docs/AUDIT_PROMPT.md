# Full-Site Audit Prompt — DeMario Montez Pickleball

Paste this entire file as your prompt in a new Claude Code session.

---

## Context

# Historical Note

This prompt is historical audit context from April 2026. The current source of
truth for launch checks is `docs/RELEASE_CHECKLIST.md`; the current developer
tracker is `docs/DEVELOPER_PLAN.md`.

You are auditing **demariomontezpb.com** — a pickleball coaching booking site for DeMario Montez (Dallas, TX).
The goal is to find every bug, UX problem, broken link, misspelling, and policy issue, then fix them all.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + Auth + MFA) · Resend (email) · Vercel (hosting)

**Working directory:** `c:\Users\tonimontez\demario-pickleball-1`

**Live site:** https://demariomontezpb.com

**Key known issues going in:**
- Booking modal UX is poor — weird zoom/scale on open, hard to read, calendar layout is confusing, step navigation is not intuitive
- Payment options (Cash App, Zelle, PayPal QR) show after booking is confirmed — need to verify they actually render and are reachable
- Admin panel must be fully functional: bookings, inquiries, availability, tasks, roadmap
- No time slots exist yet in the database — add at least the standard ones (9 AM – 5 PM, hourly) so the booking flow can actually be tested end-to-end

---

## Audit Checklist

Work through each section below. For every issue found: describe it, show the file + line, fix it, and mark it done.

---

### 1. TypeScript — Zero Errors

```bash
npx tsc --noEmit
```

Fix every type error before moving on. Nothing ships with TS errors.

---

### 2. Booking Modal — UX Overhaul

This is the most critical piece of the site. DeMario makes money through this modal.

**Read:** `src/components/BookingModal.tsx` and the related CSS in `src/app/globals.css` (search for `.modal`).

Check and fix all of the following:

**a) Open animation / zoom**
- On mobile, the modal should slide up from the bottom like a bottom sheet, not zoom/scale in awkwardly.
- On desktop, it should appear as a centered card with a gentle fade-in (no zoom).
- Check the CSS `@keyframes` and `.modal` / `.modal-backdrop` classes. Replace any `scale()` transforms that feel jarring.

**b) Modal sizing and readability**
- The modal card should be tall enough to show content without requiring the user to scroll inside it on mobile.
- Text must be legible at normal zoom — no tiny labels, no cramped padding.
- The close button must be easy to tap (minimum 44×44px touch target).

**c) Step 1 — Info form**
- Fields: Name, Email, Phone (optional), Lesson Type, Waiver checkbox.
- Lesson type select must show all three options with prices: Foundations ($70), Strategy Lab ($80), Group Clinic ($50).
- Waiver checkbox links to `/terms` — verify the link opens in a new tab.
- The "Next" button should be disabled until Name, Email, and Waiver are filled.
- Verify email validation fires on submit (not on blur) so it doesn't interrupt the user while typing.

**d) Step 2 — Date & Time picker**
- The date strip (30 days) must be horizontally scrollable and show the currently selected day highlighted.
- Day labels must clearly show day-of-week + date number (e.g., "Mon 14").
- Time slots must load from `/api/time-slots` and display in a clean grid.
- Unavailable times must be visually distinct (grayed out, strikethrough, or muted) but still visible.
- If a date is fully blocked (`allDay: true`), show a clear message: "DeMario is unavailable on this date" instead of an empty time grid.
- If no time slots exist in the database yet (`times.length === 0` after loading), show a clear message: "No lesson times available yet — check back soon or contact DeMario directly." Don't leave the user staring at a blank screen.
- The "Confirm booking" button should be disabled if no time is selected.

**e) Step 3 — Confirmed**
- After a successful booking, show the lesson summary (date, time, lesson type, booking ID short code).
- The **PaymentOptions** component (`src/components/PaymentOptions.tsx`) must render below the summary with the booking ID and lesson price passed as props.
- Verify Cash App link (`https://cash.app/$DeMarioMontez1`) and Zelle QR link open correctly.
- Verify the PayPal QR image (`/img/paypal-qr.png`) loads — check the file exists at `public/img/paypal-qr.png`.
- Confirm the memo instruction is visible: "Include Lesson [XXXXXXXX] in the memo."

**f) Error states**
- 409 conflict (slot just taken): must show "That time was just taken. Pick another." and return to picker.
- Network error: must show a human-readable message and a "Try again" button.
- Availability load failure: must show an error message, not a blank time grid.

---

### 3. Homepage — Content & Links

**Read:** `src/app/page.tsx`, `src/components/Hero.tsx`, `src/components/Nav.tsx`, `src/components/Footer.tsx`, and all other component files.

Check every piece of content on the page:

**Links and buttons:**
- Every "Book a lesson" / "Book now" CTA opens the booking modal.
- The sticky CTA bar (if present) opens the modal.
- Nav links scroll to the correct sections (`#lessons`, `#about`, `#contact`, etc.).
- Footer links (`/terms`, `/privacy`, `/pay`) all resolve to real pages.
- Instagram and TikTok links in the footer/nav point to real URLs (not placeholder `#` hrefs).
- Any "call" or phone link uses `tel:4693719220` and will dial on mobile.
- Any email link uses `mailto:demariomontez10@gmail.com`.

**Content accuracy (no misspellings, no placeholder text):**
- Coach's name is spelled correctly everywhere: **DeMario Montez** (capital M and M).
- Location: **Dallas Indoor Pickleball Club** (verify this is the correct full name).
- Phone: **(469) 371-9220** — consistent everywhere it appears.
- Email: **demariomontez10@gmail.com** — consistent.
- Prices: Foundations $70, Strategy Lab $80, Group Clinic $50 — consistent across Hero, Lessons section, and BookingModal.
- No `[PLACEHOLDER]`, `TODO`, `lorem ipsum`, or obviously fake text anywhere.
- Read testimonials in `src/lib/data.ts` — names and quotes look real and professional.

**Social proof:**
- Review quotes are complete sentences, no truncation.
- Lesson step descriptions (in `LESSONS` object in `src/lib/data.ts`) are professional and accurate.

---

### 4. Lessons Page / Section

**Read:** `src/components/Lessons.tsx`

- All three lesson types render with correct name, price, description, and duration breakdown.
- "Book this lesson" buttons (if any) open the modal with the correct lesson type pre-selected, OR navigate to the booking section.

---

### 5. Contact Form

**Read:** `src/components/ContactForm.tsx`, `src/app/api/inquiries/route.ts`

- Form fields: Name, Email, Message.
- On submit, POSTs to `/api/inquiries`.
- Shows success state after submission.
- Shows error state if the API call fails.
- Validate the API route: inserts into `inquiries` table in Supabase using the service role key (check `src/lib/supabase/server.ts` — `createServerSupabaseClient`).
- Confirm the `inquiries` table has RLS configured so inserts work without auth (public form).

---

### 6. Payment Page (`/pay`)

**Read:** `src/app/pay/page.tsx`

- Page renders the `PaymentOptions` component.
- Cash App, Zelle, and PayPal QR all present.
- No props needed (no booking ID) — shows generic payment options.
- Page has a heading and brief instructions.

---

### 7. Terms and Privacy Pages

**Read:** `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`

- Both pages render real content (not placeholder).
- No misspellings. Coach's name and business name correct throughout.
- Links back to the homepage work.

---

### 8. API Routes — Correctness and Security

Check every route in `src/app/api/`:

**Public routes (no auth required):**
| Route | Method | Check |
|-------|--------|-------|
| `/api/bookings` | POST | Validates all required fields, checks slot availability, inserts, fires emails |
| `/api/availability` | GET | Returns `{ unavailable: string[], allDay: boolean }` for a given date |
| `/api/time-slots` | GET | Returns active time slots only |
| `/api/inquiries` | POST | Inserts inquiry, no auth required |

For each public POST route:
- Inputs are validated and sanitized (no raw user data going to SQL).
- Returns correct HTTP status codes (200/201 on success, 400 on bad input, 409 on conflict, 500 on server error).
- Error messages don't leak internal details (no stack traces in responses).

**Protected routes (require Supabase Auth session):**
| Route | Method | Check |
|-------|--------|-------|
| `/api/bookings/[id]` | PATCH | Admin only — confirm/cancel booking |
| `/api/time-slots` | POST | Admin only |
| `/api/time-slots/[id]` | PATCH/DELETE | Admin only |
| `/api/blocked-slots` | GET/POST | Admin only |
| `/api/blocked-slots/[id]` | DELETE | Admin only |
| `/api/recurring-blocks` | GET/POST | Admin only |
| `/api/recurring-blocks/[id]` | DELETE | Admin only |
| `/api/tasks` | GET/POST | Admin only |
| `/api/tasks/[id]` | PATCH/DELETE | Admin only |
| `/api/roadmap/[key]` | PATCH | Admin only |
| `/api/inquiries/[id]` | PATCH | Admin only |

For each protected route:
- Calls `createServerSupabaseClient()` (service role key from `src/lib/supabase/server.ts`).
- Checks `user` is present from `supabase.auth.getUser()` — returns 401 if not.
- Uses the Supabase client for DB operations (not raw SQL with unvalidated input).

---

### 9. Supabase — RLS Policies

Run these queries against the Supabase project (`vowwokjesgdjridrikqp`) to verify all tables have correct RLS:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

Expected state for each table:

| Table | RLS | Expected policy |
|-------|-----|-----------------|
| `bookings` | ON | Public INSERT (booking API uses service role but also anon for availability checks); authenticated full access |
| `time_slots` | ON | Public SELECT (booking modal reads slots); authenticated full access for writes |
| `blocked_slots` | ON | Public SELECT; authenticated full access for writes |
| `recurring_blocks` | ON | Public SELECT; authenticated full access for writes |
| `inquiries` | ON | Public INSERT; authenticated full access |
| `admin_tasks` | ON | Authenticated full access (was missing INSERT policy — recently fixed; verify it's there) |
| `roadmap_checks` | ON | Authenticated full access |

Fix any table that is missing required policies.

---

### 10. Admin Panel — Full Walkthrough

**Auth flow:**
- `/admin/login` — email + password sign-in works.
- After sign-in, if MFA not enrolled → redirected to `/admin/mfa-setup`.
- After sign-in, if MFA enrolled but not verified → redirected back to login with error.
- After MFA verified (aal2) → `/admin` loads.
- Non-admin email (not in `ADMIN_EMAIL` env var) → rejected with 403.

**Read `src/app/admin/(protected)/layout.tsx`** — verify it checks both `aal2` assurance level AND `isAdminEmail()`.

**Bookings tab:**
- Lists all bookings sorted by date.
- Confirm button → sets status to `confirmed`.
- Cancel button → sets status to `cancelled`, fires cancellation email to student.
- Mark Paid → toggles `paid_at` timestamp.
- Each row shows: student name, email, lesson type, date, time, status, paid status.

**Inquiries tab:**
- Lists all contact form submissions.
- Mark read / Mark unread toggle works.

**Availability tab:**
- **Time slots section:** Add a slot (e.g., `9:00 AM`) → appears in the list. Toggle active/hidden. Delete slot.
- **Add the standard lesson slots right now** so the booking modal is testable:
  ```
  9:00 AM, 10:00 AM, 11:00 AM, 12:00 PM, 1:00 PM, 2:00 PM, 3:00 PM, 4:00 PM, 5:00 PM
  ```
  Insert these via Supabase SQL or the admin UI.
- **Recurring blocks section:** Add a recurring block → verify it shows in availability API.
- **One-off blocks section:** Add a date block → verify it shows in availability API.

**Tasks tab:**
- Create a task → saves and appears in list. (Recently fixed RLS issue — verify it works.)
- Complete a task → moves to completed section.
- Delete a task → removes it.
- Recurring task completion → spawns next occurrence.

**Roadmap tab:**
- All phases and items render.
- Checking an item saves to `roadmap_checks` in Supabase.
- Refresh page → checked state persists.

---

### 11. Email System

**Read:** `src/lib/email/client.ts`, `src/lib/email/templates.ts`, `src/lib/email/ics.ts`

- `RESEND_API_KEY` is set in the environment — if not, emails silently skip and log a warning.
- `EMAIL_FROM` is set and formatted correctly: `DeMario Pickleball <bookings@demariomontezpb.com>`.
- `ADMIN_EMAIL` first address (used for admin notification) is `demariomontez10@gmail.com`.

**Test booking email end-to-end:**
1. Add a time slot in admin if not already done.
2. Submit a test booking via the modal with a real email address.
3. Check the inbox — confirm email arrives with:
   - Lesson details (date, time, type, booking ID).
   - "Pay DeMario" button linking to `https://demariomontezpb.com/pay`.
   - "Add to Google Calendar" blue button — verify the URL is a valid Google Calendar `render?action=TEMPLATE` URL.
   - ICS attachment (`.ics` file) that opens in a calendar app.
4. Check DeMario's inbox (`demariomontez10@gmail.com`) — admin notification arrives with student info and dashboard link.

**Test cancellation email:**
1. In the admin panel, cancel the test booking.
2. Student inbox should receive a cancellation email with an ICS CANCEL attachment.

---

### 12. Mobile Responsiveness

Resize the browser to 375px width (iPhone SE) and check every page and component:

- Nav menu opens and closes cleanly; all links accessible.
- Hero section readable; CTA button full-width and easy to tap.
- Booking modal takes up most of the screen height; internal content scrolls if needed.
- Date strip in booking modal is horizontally scrollable.
- Time grid wraps properly; buttons are at least 44px tall.
- Payment options cards are full-width and readable.
- Footer links stack vertically, no overflow.
- Lessons section cards stack vertically.
- Admin panel is usable on mobile (table rows may scroll horizontally — that's OK, but nothing should break).

---

### 13. Performance and SEO Basics

```bash
# Build and check for warnings
npm run build 2>&1 | tail -50
```

- No build errors.
- No "missing key" React warnings.
- `<title>` and `<meta description>` set on the homepage and major pages.
- `public/robots.txt` exists (or `src/app/robots.ts` generates one).
- `src/app/sitemap.ts` generates a valid sitemap.
- Images use `next/image` where possible (or have explicit `width`/`height` on `<img>` tags).

---

### 14. Environment Variables

Verify all required env vars are set for local dev (`.env.local`) and production (Vercel):

| Variable | Purpose | Required |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | Yes |
| `NEXT_PUBLIC_SITE_URL` | `https://demariomontezpb.com` | Yes |
| `ADMIN_EMAIL` | Comma-separated admin email list | Yes |
| `RESEND_API_KEY` | Resend transactional email key | Yes |
| `EMAIL_FROM` | From address for all emails | Yes |

Run locally with `npm run dev` and confirm no "missing env var" warnings in the terminal.

---

### 15. Final Commit

After all fixes:

```bash
npx tsc --noEmit          # must be clean
npm run build             # must succeed
git add -A
git commit -m "audit: fix booking UX, verify all links, resolve RLS, add time slots"
git push
```

Wait for Vercel to deploy, then verify the live site at https://demariomontezpb.com.

---

## Definition of Done

All of the following must be true before this audit is considered complete:

- [ ] `npx tsc --noEmit` exits with 0 errors
- [ ] `npm run build` succeeds with no errors
- [ ] Booking modal opens cleanly on mobile (no jarring zoom/scale animation)
- [ ] Booking flow completes end-to-end: form → date/time picker → confirmed → payment options visible
- [ ] Payment options (Cash App, Zelle, PayPal QR) render correctly on the confirmation screen and on `/pay`
- [ ] No broken links, placeholder text, or misspellings anywhere on the public site
- [ ] Phone number `(469) 371-9220` links correctly with `tel:`
- [ ] All admin panel features work: bookings, inquiries, availability, tasks, roadmap
- [ ] `admin_tasks` RLS allows authenticated INSERT (fix already applied — verify)
- [ ] At least 9 time slots exist in the database so the booking flow can be tested
- [ ] Test booking email arrives in student inbox with ICS + Google Calendar link
- [ ] Admin notification email arrives at `demariomontez10@gmail.com`
- [ ] Site is deployed and live on Vercel
