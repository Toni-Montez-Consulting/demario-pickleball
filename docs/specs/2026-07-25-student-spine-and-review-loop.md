# Design: Student Spine and Review Loop

Date: 2026-07-25
Status: Proposed — not implemented
Owner: Tonio
Round: 1 of 2

---

## 1. Why This Work

DeMario reported his current operating reality in July 2026:

- 600+ individual clients coached lifetime
- 100+ people in his active network, ~60 of whom he could book "pretty easily"
- 25–30 lessons per week across private lessons, group clinics, drilling sessions, and
  play-with-the-pro games
- He wants students to leave reviews on the site after a lesson
- He wants his Instagram clips on the site

The site as built is a customer-acquisition funnel. DeMario is at or near capacity on
teaching hours, so acquisition is not the constraint. The constraints are **dollars per
hour**, **repeat rate**, and **his admin time**.

Every yield-and-retention feature (packages, rebooking, lesson history, review targeting,
"who have I not seen in 60 days") requires a person object. The system does not have one:
`bookings` stores name, email, and phone as loose text, and `student_id` appears nowhere in
the codebase. That missing object is the blocker underneath everything else.

Payments stay manual for now, which means packages become a **credits ledger**, which is by
definition a thing attached to a person. Same conclusion.

---

## 2. Locked Decisions

| Decision | Locked to |
|---|---|
| Optimization axis | Yield + retention (not lead generation) |
| Payments | Stay manual (Cash App / Zelle / PayPal). No Stripe this round. |
| Review destination | On-site first, Google hand-off second |
| Review delivery | Email, auto-sent 24h after the lesson (Resend, already wired) |
| Past-client outreach | Public shareable `/review` link, flagged as unverified |
| Moderation | Mario approves before publish. **No editing of student words.** |
| Existing testimonials | Confirmed real and permissioned. Seeded into the reviews table as `legacy`. |
| Google Business Profile | Does not exist yet. Hand-off built but dark behind an env var. |
| Video hosting | Self-hosted MP4 in `public/video/`. Not Instagram embeds. |
| `5.0 ★ · 79 reviews` claim | **Still open.** Awaiting Mario's answer on the source. |

### Why not Instagram embeds

Limitations check. The IG embed script is a third-party render blocker that hurts load
time, the clips disappear if a post is deleted or archived, and it pulls third-party
cookies into the consent banner. DeMario said he would download and send the files, so we
take the files. Self-hosting costs a few MB in the repo and buys permanence and speed.

### Limitations check: the review loop itself

- **Known ceiling:** review requests get ignored. Coach-to-student email asks typically land
  in the low double digits for response rate. The 600-client list is a one-time harvest, not
  a renewable well.
- **Typical failure mode:** ships, collects four reviews, looks thin, gets abandoned.
  Mitigation is volume at launch — the public link plus Mario's own outreach on day one,
  not a slow drip from new bookings alone.
- **Best practice:** ask within 24 hours, one click to a rating, text optional, personal
  framing rather than transactional.
- **Alternatives:** a third-party widget (Trustpilot, Endorsal) costs monthly, puts another
  brand on his proof, and leaves him not owning the data.
- **Verdict:** use. The ceiling is real; it is still the only feature here that produces a
  compounding asset.

---

## 3. Non-Goals For Round 1

Explicitly **not** built in this round. Naming these prevents "designed to scale" from
turning into "built everything."

- Stripe or any card payment
- Packages / lesson credits ledger
- Drilling sessions and play-with-the-pro as bookable formats
- SMS (Twilio or otherwise)
- Admin video upload UI
- Google review import
- Analytics
- 24-hour lesson reminders
- Student self-serve reschedule / cancel

Round 2 begins when DeMario sends pricing, duration, and player counts for drilling
sessions and play-with-the-pro games.

---

## 4. Data Model

### 4.1 `students` (new)

```sql
create table students (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  phone_normalized   text,
  email_normalized   text,
  source             text not null default 'site',
  notes              text,
  first_seen_at      timestamptz not null default now(),
  last_lesson_at     timestamptz,
  needs_review       boolean not null default false,
  needs_review_reason text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index students_phone_key
  on students (phone_normalized) where phone_normalized is not null;
create unique index students_email_key
  on students (email_normalized) where email_normalized is not null;
```

`source` values: `site` | `manual` | `teachmeto` | `podplay` | `lifetime` | `import`. The
column exists from day one so students from other venues and platforms fold in later
without a migration. Only `site` and `manual` are written this round.

`metadata` jsonb is the extensibility seam. It costs nothing now and prevents a painful
migration later.

**Lesson count is derived by query, never stored.** A denormalized counter is a value that
can silently disagree with reality. No stored counters.

### 4.2 `bookings` (altered)

```sql
alter table bookings add column student_id uuid references students(id) on delete set null;
alter table bookings add column review_request_sent_at timestamptz;
create index bookings_student_id_idx on bookings (student_id);
```

`bookings.status` gains `no_show` alongside the existing values. This excludes no-shows from
review requests and gives Mario a no-show record he does not currently have — useful on its
own for the yield goal.

### 4.3 `reviews` (new)

```sql
create table reviews (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references students(id) on delete set null,
  booking_id        uuid references bookings(id) on delete set null,
  rating            smallint not null check (rating between 1 and 5),
  body              text,
  display_name      text not null,
  lesson_context    text,
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
  constraint reviews_consent_required check (consent_publish)
);

create index reviews_status_idx on reviews (status, published_at desc);
```

`constraint reviews_consent_required` makes a non-consented row impossible to store, not
merely rejected at the API layer.

`token_hash` — the raw token is emailed and never persisted. Hashed with the existing
SHA-256 + salt utility already used for IP hashing in `src/lib/rate-limit.ts`.

`source` values: `site` | `legacy` | `google` | `teachmeto`. Only `site` and `legacy` are
written this round.

### 4.4 Legacy testimonial seed

The three existing testimonials in `src/lib/data.ts` are confirmed real and permissioned.
They are seeded as rows with `source: 'legacy'`, `status: 'published'`,
`verified_booking: false`, `consent_publish: true`, carrying their existing quote,
display name, and lesson context.

The `REVIEWS` constant and the `Review` interface are then **deleted** from
`src/lib/data.ts`. One review system, one source of truth. The wall starts at three rather
than empty. `src/lib/data.test.ts` and `src/components/Testimonials.tsx` both reference
`REVIEWS` today and are updated in the same change. `LESSONS`, `generateDays`, and the
lesson types in `data.ts` are untouched.

### 4.5 RLS

Consistent with the existing model in `docs/APP_OVERVIEW.md` §12: anon has no direct read or
write on `students` or `reviews`. All public reads and mutations go through Next.js API
routes using the service-role key.

---

## 5. Student Matching and Backfill

### 5.1 Matching rule

On every new booking:

1. Normalize phone to 10 digits, email to lowercase-trimmed.
2. Match on `phone_normalized` first, then `email_normalized`.
3. On match: attach `booking.student_id`.
4. On no match: create the student with `source: 'site'`.

**The fail-loud case.** When a booking matches an existing student by phone but carries a
different name or email, it attaches to the matched student **and** sets
`needs_review = true` with a reason string. Admin surfaces the flag. The system never
silently merges two people and never silently creates a duplicate of one.

### 5.2 Backfill

A one-time script walks existing `bookings`, normalizes, creates students, and sets
`student_id`. It prints a reconciliation report and exits non-zero if the numbers do not
balance:

```text
bookings processed:  N
students created:    N
bookings matched:    N
bookings unmatched:  N   <- each listed by booking ID and reason
```

Unmatched rows (no usable phone and no usable email) are listed, never swallowed. A
plausible-but-wrong student count is worse than a crash.

---

## 6. Review Request Cron

`GET /api/cron/review-requests`, protected by `CRON_SECRET`, run daily via Vercel Cron.

**Eligibility.** A booking gets a review request when all of these hold:

- `status = 'confirmed'` (excludes `cancelled` and `no_show`)
- lesson end time is more than 24 hours in the past
- `review_request_sent_at is null`
- `student_id is not null`
- no existing review row for that booking
- the student has not been asked in the last 90 days

**Idempotence.** `review_request_sent_at` is stamped on send, so a re-run cannot double-ask.

**Reporting.** The response body returns `sent`, `skipped` with per-reason counts, and
`failed` with booking IDs. Failures are listed, not swallowed.

---

## 7. Student-Facing Surfaces

### 7.1 `/review/[token]`

Server-renders the lesson date and lesson type so the student knows which session they are
reviewing. Form fields:

- Rating, 1–5, required
- Written review, optional
- How your name appears, defaulting to first name + last initial
- Publish consent checkbox, **required**, enforced server-side as well as in the UI

On submit, `token_used_at` is stamped. Revisiting a used token shows a thank-you state, not
a second form.

### 7.2 `/review` (public)

Same form, no token. Sets `verified_booking = false`. Collects phone or email so the
submission can be matched to a student when one exists. Rate-limited and honeypotted using
the existing `src/lib/rate-limit.ts` module, consistent with the booking and inquiry forms.

This is the surface Mario shares with the 600 past clients.

### 7.3 Thank-you screen

Confirms the review is pending Mario's approval. When `GOOGLE_REVIEW_URL` is set, it also
offers one tap to post the same text to his Google Business Profile, with the text copied to
the clipboard. **The profile does not exist yet**, so the button is dark until the variable
is populated.

---

## 8. Admin

`/admin/reviews`, gated by the existing Supabase session + AAL2 MFA + `ADMIN_EMAIL`
allowlist, same as every other admin route.

- Pending queue with rating, text, display name, verified/unverified badge, and student link
- Actions: **Publish**, **Hide**, **Delete**
- **No edit action.** Published reviews are the student's words or the feature is worthless.
- Unverified public submissions are visually distinct so Mario knows to look harder

API: `GET /api/reviews` (list by status), `PATCH /api/reviews/[id]` (publish/hide),
`DELETE /api/reviews/[id]`.

---

## 9. Homepage Display

`src/components/Testimonials.tsx` reads published reviews from
`GET /api/reviews/published` (public, cached) rather than the deleted `REVIEWS` constant.
The homepage is a client component, so this is a fetch rather than a server read.

Ordering: verified bookings first, then most recent.

**Open and deliberately unresolved:** the `5.0 ★ · 79 reviews` claim in
`src/components/Hero.tsx` and `src/components/TrustBar.tsx`. Once real reviews accumulate,
the honest version computes both the count and the average from published rows. That
switchover waits on Mario's answer about where the 79 came from.

---

## 10. Film Room

A homepage section built from a curated `VIDEOS` constant in `src/lib/`. Not an admin upload
UI — that is a later round.

Each entry: MP4 in `public/video/`, poster JPG, the coaching concept it demonstrates, and a
one-line "what to watch for." Native `<video>` with `preload="none"`, `playsInline`,
`muted`, and controls. Nothing downloads until the student taps.

The organizing idea is that a clip is attached to a concept — the reset, the third-shot
drop, the stack — so the section doubles as proof and as the answer to "what will you
actually teach me." It is not a generic video gallery.

**Ceiling:** `public/` is fine for roughly 6–10 short clips. Past that, or the moment Mario
wants to add his own, this moves to Vercel Blob.

---

## 11. Error Handling

- Consent enforced at the API **and** by database constraint
- Public review endpoint rate-limited and honeypotted like existing public POSTs
- Used tokens render a thank-you state, never a second submission
- Cron is idempotent via `review_request_sent_at`
- Cron reports failures by booking ID rather than failing silently
- Backfill exits non-zero on an unbalanced reconciliation
- Name/email mismatch on a phone match raises `needs_review`, never a silent merge

---

## 12. Testing

**Vitest**

- Phone and email normalization
- Student matching: new, phone match, email match, and the mismatch-flag case
- Backfill reconciliation, including the unbalanced-count failure
- Review token generation, hashing, and validation
- Cron eligibility: no-show excluded, cancelled excluded, 24h window, 90-day dedupe,
  no double-send
- Consent enforcement
- Published-review ordering

**Playwright**

- Tokenized review link submits and lands pending
- Used token shows the thank-you state
- Public `/review` submits and is flagged unverified
- `/admin/reviews` redirects unauthenticated users
- Homepage renders published reviews

**Verification:** `npm run ci` and `npm run test:e2e`, per `AGENTS.md`. Public-flow changes
require the e2e suite.

---

## 13. Environment Additions

| Variable | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | Yes | Protects `/api/cron/review-requests` |
| `GOOGLE_REVIEW_URL` | No | Google Business Profile review link. Hand-off stays dark until set. |

---

## 14. Open Inputs From DeMario

These block completeness, not the build.

1. **Pricing, duration, and player count** for drilling sessions and play-with-the-pro games.
   Also confirmation that group clinics are still $50/player for 90 minutes. Gates round 2.
2. **The source of `5.0 ★ · 79 reviews`.** If it is a real TeachMe.To or Google rating, link
   it. If it was an estimate, replace it with `600+ students coached`, which he can back up.
3. **Google Business Profile.** Does not exist. Before writing this as a task in
   `docs/MARIO_ACTION_PLAN.md`, verify against live Google documentation how service-area
   businesses that teach at public courts and third-party venues qualify. Do not guess at
   eligibility rules.

---

## 15. Round 2 Preview

Once DeMario's format numbers land:

- Add drilling sessions and play-with-the-pro to the lesson catalog and booking modal
- Packages as a manual credits ledger on the student record, with a visible warning when a
  student with zero credits books — no silent drift between money received and credits left
- One-tap rebooking from the student record

---

## 16. Pre-Implementation Verification

Knowledge cutoff is May 2026. Before writing code, verify against live documentation:

- Vercel Cron behavior and frequency limits on this project's plan
- Next.js 16 route handler and cron conventions
- Current Resend API surface for the new template

Do not build from memory on any of the three.
