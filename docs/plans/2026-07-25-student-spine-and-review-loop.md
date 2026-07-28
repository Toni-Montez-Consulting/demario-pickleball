# Student Spine and Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site a student object, an on-site review capture loop with admin moderation, and a self-hosted Film Room section.

**Architecture:** A `students` table becomes the person object that bookings and reviews both hang off, matched canonically by normalized phone with email as fallback. Reviews are created either from a tokenized link emailed 24h after a lesson by a daily Vercel cron, or from a public link Mario shares with past clients; both land in a pending queue that Mario publishes from admin. Pure logic (normalization, matching, eligibility, tokens) lives in `src/lib/` as functions that take a `SupabaseClient` argument, matching the existing `checkRateLimit` idiom, so it is testable without a live database.

**Tech Stack:** Next.js 16 App Router, TypeScript 5 strict, Supabase (service-role via API routes), Resend, Vercel Cron, Vitest 4 (jsdom, no file parallelism), Playwright.

**Spec:** `docs/specs/2026-07-25-student-spine-and-review-loop.md`

## Global Constraints

- Branch is `feat/student-spine-review-loop`. Default branch is `master`. Conventional Commits.
- Never commit secrets, `.env.local`, Supabase keys, Google tokens, or Resend keys.
- Admin API routes use `requireAdmin()` from `src/lib/supabase/server.ts` — Supabase session **plus** AAL2 MFA **plus** the `ADMIN_EMAIL` allowlist. No exceptions.
- Public reads and writes go through Next.js API routes using `createServiceRoleClient()`. Anon has no direct table access.
- **No edit action on reviews.** Mario may publish, hide, or delete. He may never alter a student's words.
- Consent is enforced at the API layer **and** by the `reviews_consent_required` database constraint.
- Lesson count is always derived by query. Never store a counter.
- Fail loud: a phone match with a mismatched name or email sets `needs_review`, never a silent merge. The backfill exits non-zero on an unbalanced reconciliation. The cron reports failures by booking ID.
- Existing public-endpoint pattern is mandatory for new public POSTs: honeypot field check first, then `checkRateLimit`, then validation, then write.
- Verification per `AGENTS.md`: `npm run ci` (typecheck → lint → test → build). Public-flow changes also require `npm run test:e2e`.
- Tests run with `--no-file-parallelism`. Do not add parallel test config.

---

### Task 1: Database migration and legacy review seed

**Files:**
- Create: `docs/supabase-students-reviews-migration.sql`

**Interfaces:**
- Consumes: nothing
- Produces: tables `students` and `reviews`; columns `bookings.student_id`, `bookings.review_request_sent_at`; booking status value `no_show`

This task is SQL only. It is applied by hand in the Supabase SQL Editor, matching how `docs/supabase-p0-migration.sql` and `docs/supabase-p1-hardening.sql` are already handled in this repo.

- [ ] **Step 1: Write the migration file**

```sql
-- docs/supabase-students-reviews-migration.sql
-- Run once in the Supabase SQL Editor. Idempotent.

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

create unique index if not exists students_phone_key
  on students (phone_normalized) where phone_normalized is not null;
create unique index if not exists students_email_key
  on students (email_normalized) where email_normalized is not null;

alter table bookings add column if not exists student_id uuid references students(id) on delete set null;
alter table bookings add column if not exists review_request_sent_at timestamptz;
create index if not exists bookings_student_id_idx on bookings (student_id);

create table if not exists reviews (
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
  -- Mario's editorial metadata, set at publish time. Not the student's words.
  -- A review with a takeaway is promoted to the featured carousel slot.
  tag               text,
  takeaway          text,
  token_hash        text unique,
  token_used_at     timestamptz,
  submitted_ip_hash text,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  constraint reviews_consent_required check (consent_publish)
);

create index if not exists reviews_status_idx on reviews (status, published_at desc);

alter table students enable row level security;
alter table reviews  enable row level security;
-- No anon policies. All access is service-role through API routes.

-- Legacy testimonial seed. All seven currently hardcoded in the site are carried over:
-- three from REVIEWS (the featured carousel, which have tag + takeaway) and four from
-- REVIEW_WALL in Testimonials.tsx. A non-null takeaway promotes a review to the carousel.
insert into reviews (rating, body, display_name, lesson_context, tag, takeaway, consent_publish, verified_booking, source, status, published_at)
select * from (values
  (5, 'DeMario doesn''t just teach you how to hit the ball — he teaches you how to think the point. Two months in and I''m reading opponents in a way I never could before.',
      'Rachel K.', 'Intermediate · 12 lessons', 'Strategy', 'Better point construction'),
  (5, 'Most coaches feed you balls for an hour. DeMario built a real plan around my weak spots. My DUPR jumped 0.4 in a season.',
      'Marcus T.', 'Competitive · 20 lessons', 'Competitive', 'Targeted practice plan'),
  (5, 'I was the person dinking into the net every point. After four sessions I played my first tournament — and won my first match.',
      'Jenna P.', 'Beginner · 6 lessons', 'Beginner', 'First tournament confidence')
) as v(rating, body, display_name, lesson_context, tag, takeaway)
cross join lateral (select true, false, 'legacy', 'published', now()) as c(consent_publish, verified_booking, source, status, published_at)
where not exists (select 1 from reviews r where r.source = 'legacy' and r.display_name = v.display_name);

insert into reviews (rating, body, display_name, lesson_context, consent_publish, verified_booking, source, status, published_at)
select * from (values
  (5, 'Actually explains why, not just what. Game-changer.', 'David L.', 'Shot selection'),
  (5, 'Patient, sharp, and fun. My wife and I both take lessons now.', 'Carlos M.', 'Doubles lessons'),
  (5, 'First coach that made strategy feel doable at a 3.0 level.', 'Priya S.', 'Beginner strategy'),
  (5, 'Showed up for my tournament to scout opponents. Unreal.', 'Tom B.', 'Tournament support')
) as v(rating, body, display_name, lesson_context)
cross join lateral (select true, false, 'legacy', 'published', now()) as c(consent_publish, verified_booking, source, status, published_at)
where not exists (select 1 from reviews r where r.source = 'legacy' and r.display_name = v.display_name);
```

If the `cross join lateral` form is awkward in the Supabase editor, write seven separate
`insert ... select ... where not exists` statements instead. The requirement is idempotence,
not cleverness.

- [ ] **Step 2: Check the bookings status constraint**

Run this in the Supabase SQL Editor to see whether `bookings.status` has a CHECK constraint that would reject `no_show`:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'bookings'::regclass and contype = 'c';
```

If a status CHECK exists and omits `no_show`, append this to the migration file, substituting the real constraint name:

```sql
alter table bookings drop constraint <constraint_name>;
alter table bookings add constraint <constraint_name>
  check (status in ('pending','confirmed','cancelled','no_show'));
```

If no status CHECK exists, add a comment to the migration file recording that and move on.

- [ ] **Step 3: Commit**

```bash
git add docs/supabase-students-reviews-migration.sql
git commit -m "feat(db): add students and reviews tables with legacy testimonial seed"
```

---

### Task 2: Student normalization and matching

**Files:**
- Create: `src/lib/students.ts`
- Test: `src/lib/students.test.ts`

**Interfaces:**
- Consumes: `createServiceRoleClient` from `@/lib/supabase/server`
- Produces:
  - `normalizePhone(raw: string | null | undefined): string | null`
  - `normalizeEmail(raw: string | null | undefined): string | null`
  - `type StudentMatch = { student: { id: string; name: string; email_normalized: string | null; phone_normalized: string | null }; created: boolean; needsReview: boolean; needsReviewReason: string | null }`
  - `findOrCreateStudent(supabase: SupabaseClient, input: { name: string; email: string; phone: string; source?: string }): Promise<StudentMatch | null>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/students.test.ts
import { describe, it, expect } from "vitest";
import { normalizePhone, normalizeEmail } from "./students";

describe("normalizePhone", () => {
  it("strips formatting from a 10-digit US number", () => {
    expect(normalizePhone("(469) 371-9220")).toBe("4693719220");
  });
  it("drops a leading country code 1", () => {
    expect(normalizePhone("+1 469-371-9220")).toBe("4693719220");
  });
  it("returns null for an unusable number", () => {
    expect(normalizePhone("555")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Rachel.K@Example.COM ")).toBe("rachel.k@example.com");
  });
  it("returns null for a non-email", () => {
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/lib/students.test.ts`
Expected: FAIL — cannot find module `./students`

- [ ] **Step 3: Write the normalizers**

```ts
// src/lib/students.ts
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) return null;
  return trimmed;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/lib/students.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing matching tests**

Append to `src/lib/students.test.ts`:

```ts
import { findOrCreateStudent } from "./students";

// Minimal fake matching the query chain findOrCreateStudent uses.
function fakeSupabase(existing: Record<string, unknown> | null) {
  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const client = {
    from() {
      return {
        select() {
          return {
            or() {
              return {
                limit: async () => ({ data: existing ? [existing] : [], error: null }),
              };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: "new-id", ...row }, error: null }),
            }),
          };
        },
        update(row: Record<string, unknown>) {
          updated.push(row);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, inserted, updated };
}

describe("findOrCreateStudent", () => {
  it("creates a student when none matches", async () => {
    const { client, inserted } = fakeSupabase(null);
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "rachel@example.com",
      phone: "(469) 371-9220",
    });
    expect(result?.created).toBe(true);
    expect(result?.needsReview).toBe(false);
    expect(inserted[0]).toMatchObject({
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
      source: "site",
    });
  });

  it("matches an existing student on phone and does not flag when details agree", async () => {
    const { client, inserted } = fakeSupabase({
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
    });
    const result = await findOrCreateStudent(client, {
      name: "Rachel K",
      email: "rachel@example.com",
      phone: "469-371-9220",
    });
    expect(result?.created).toBe(false);
    expect(result?.needsReview).toBe(false);
    expect(inserted).toHaveLength(0);
  });

  it("flags needs_review when a phone match carries a different name", async () => {
    const { client, updated } = fakeSupabase({
      id: "s1",
      name: "Rachel K",
      phone_normalized: "4693719220",
      email_normalized: "rachel@example.com",
    });
    const result = await findOrCreateStudent(client, {
      name: "Someone Else",
      email: "rachel@example.com",
      phone: "4693719220",
    });
    expect(result?.created).toBe(false);
    expect(result?.needsReview).toBe(true);
    expect(result?.needsReviewReason).toContain("name");
    expect(updated[0]).toMatchObject({ needs_review: true });
  });

  it("returns null when there is no usable phone or email", async () => {
    const { client } = fakeSupabase(null);
    const result = await findOrCreateStudent(client, {
      name: "Nobody",
      email: "nope",
      phone: "555",
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm run test -- src/lib/students.test.ts`
Expected: FAIL — `findOrCreateStudent` is not exported

- [ ] **Step 7: Implement matching**

Append to `src/lib/students.ts`:

```ts
export interface StudentRow {
  id: string;
  name: string;
  phone_normalized: string | null;
  email_normalized: string | null;
}

export interface StudentMatch {
  student: StudentRow;
  created: boolean;
  needsReview: boolean;
  needsReviewReason: string | null;
}

export async function findOrCreateStudent(
  supabase: SupabaseClient,
  input: { name: string; email: string; phone: string; source?: string }
): Promise<StudentMatch | null> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  // No usable canonical key. Caller must handle this rather than guess.
  if (!phone && !email) return null;

  const filters = [
    phone ? `phone_normalized.eq.${phone}` : null,
    email ? `email_normalized.eq.${email}` : null,
  ].filter(Boolean).join(",");

  const { data, error } = await supabase
    .from("students")
    .select("id,name,phone_normalized,email_normalized")
    .or(filters)
    .limit(1);

  if (error) {
    console.error("[students] lookup failed", error);
    return null;
  }

  const existing = (data?.[0] ?? null) as StudentRow | null;

  if (!existing) {
    const { data: created, error: insertError } = await supabase
      .from("students")
      .insert({
        name,
        phone_normalized: phone,
        email_normalized: email,
        source: input.source ?? "site",
      })
      .select()
      .single();
    if (insertError || !created) {
      console.error("[students] insert failed", insertError);
      return null;
    }
    return { student: created as StudentRow, created: true, needsReview: false, needsReviewReason: null };
  }

  // Matched an existing person. Never silently merge conflicting details.
  const mismatches: string[] = [];
  if (existing.name.trim().toLowerCase() !== name.toLowerCase()) {
    mismatches.push(`name on file is "${existing.name}", booking says "${name}"`);
  }
  if (email && existing.email_normalized && existing.email_normalized !== email) {
    mismatches.push(`email on file is "${existing.email_normalized}", booking says "${email}"`);
  }

  if (mismatches.length > 0) {
    const reason = mismatches.join("; ");
    const { error: flagError } = await supabase
      .from("students")
      .update({ needs_review: true, needs_review_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (flagError) console.error("[students] flag failed", flagError);
    return { student: existing, created: false, needsReview: true, needsReviewReason: reason };
  }

  return { student: existing, created: false, needsReview: false, needsReviewReason: null };
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npm run test -- src/lib/students.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 9: Commit**

```bash
git add src/lib/students.ts src/lib/students.test.ts
git commit -m "feat(students): add phone/email normalization and fail-loud student matching"
```

---

### Task 3: Attach students to bookings, add no_show status

**Files:**
- Modify: `src/app/api/bookings/route.ts` (POST handler, after the successful insert)
- Modify: `src/app/api/bookings/[id]/route.ts` (the `status` allowlist)

**Interfaces:**
- Consumes: `findOrCreateStudent` from Task 2
- Produces: bookings carry `student_id`; `no_show` is an accepted admin status

- [ ] **Step 1: Read the current booking POST handler**

Run: `cat src/app/api/bookings/route.ts`

Find the successful insert that returns the created booking. The student attach goes immediately after it, before the response is returned.

- [ ] **Step 2: Add the student attach**

After the booking insert succeeds and before emails are sent, insert:

```ts
  // Attach the booking to a student record. Never block the booking on this.
  const match = await findOrCreateStudent(supabase, {
    name: data.name,
    email: data.email,
    phone: data.phone,
  });
  if (match) {
    const { error: linkError } = await supabase
      .from("bookings")
      .update({ student_id: match.student.id })
      .eq("id", data.id);
    if (linkError) console.error("[bookings] student link failed", linkError);
    await supabase
      .from("students")
      .update({ last_lesson_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", match.student.id);
  } else {
    console.warn("[bookings] no usable student key for booking", data.id);
  }
```

Add the import at the top of the file:

```ts
import { findOrCreateStudent } from "@/lib/students";
```

- [ ] **Step 3: Widen the admin status allowlist**

In `src/app/api/bookings/[id]/route.ts`, change:

```ts
    if (!["confirmed", "cancelled"].includes(status)) {
```

to:

```ts
    if (!["confirmed", "cancelled", "no_show"].includes(status)) {
```

The cancellation email must fire only for `cancelled`, not for `no_show`. Read the surrounding code and confirm the email call is guarded on `status === "cancelled"`. If it is guarded on "not confirmed" or similar, tighten it to an explicit equality check on `"cancelled"`.

- [ ] **Step 4: Run the full unit suite**

Run: `npm run test`
Expected: PASS. If `src/components/BookingModal.test.tsx` or an availability test breaks, the change touched shared behavior — fix it before continuing.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/bookings/route.ts "src/app/api/bookings/[id]/route.ts"
git commit -m "feat(bookings): attach bookings to student records and accept no_show status"
```

---

### Task 4: Backfill script with reconciliation

**Files:**
- Create: `scripts/backfill-students.mjs`

**Interfaces:**
- Consumes: `students` and `bookings` tables
- Produces: existing bookings carry `student_id`; a printed reconciliation report

This script is run once, by hand, with the service-role key in the environment. It must never silently drop a booking.

- [ ] **Step 1: Write the script**

```js
// scripts/backfill-students.mjs
// One-time backfill. Run: node scripts/backfill-students.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}
function normalizeEmail(raw) {
  if (!raw) return null;
  const t = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

const { data: bookings, error } = await supabase
  .from("bookings")
  .select("id,name,email,phone,lesson_date,student_id")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Failed to read bookings:", error);
  process.exit(1);
}

let created = 0;
let matched = 0;
let alreadyLinked = 0;
const unmatched = [];

for (const b of bookings) {
  if (b.student_id) { alreadyLinked++; continue; }

  const phone = normalizePhone(b.phone);
  const email = normalizeEmail(b.email);
  if (!phone && !email) {
    unmatched.push({ id: b.id, reason: "no usable phone or email", name: b.name });
    continue;
  }

  const filters = [
    phone ? `phone_normalized.eq.${phone}` : null,
    email ? `email_normalized.eq.${email}` : null,
  ].filter(Boolean).join(",");

  const { data: found, error: findErr } = await supabase
    .from("students").select("id").or(filters).limit(1);
  if (findErr) {
    unmatched.push({ id: b.id, reason: `lookup error: ${findErr.message}`, name: b.name });
    continue;
  }

  let studentId = found?.[0]?.id ?? null;
  if (!studentId) {
    const { data: ins, error: insErr } = await supabase
      .from("students")
      .insert({
        name: b.name,
        phone_normalized: phone,
        email_normalized: email,
        source: "site",
        last_lesson_at: b.lesson_date ? new Date(b.lesson_date).toISOString() : null,
      })
      .select("id").single();
    if (insErr) {
      unmatched.push({ id: b.id, reason: `insert error: ${insErr.message}`, name: b.name });
      continue;
    }
    studentId = ins.id;
    created++;
  } else {
    matched++;
  }

  const { error: linkErr } = await supabase
    .from("bookings").update({ student_id: studentId }).eq("id", b.id);
  if (linkErr) {
    unmatched.push({ id: b.id, reason: `link error: ${linkErr.message}`, name: b.name });
  }
}

const processed = bookings.length;
const accounted = created + matched + alreadyLinked + unmatched.length;

console.log("");
console.log("bookings processed:  " + processed);
console.log("already linked:      " + alreadyLinked);
console.log("students created:    " + created);
console.log("bookings matched:    " + matched);
console.log("bookings unmatched:  " + unmatched.length);
for (const u of unmatched) {
  console.log(`  - ${u.id}  ${u.name ?? "(no name)"}  :: ${u.reason}`);
}
console.log("");

if (accounted !== processed) {
  console.error(`RECONCILIATION FAILED: accounted for ${accounted} of ${processed} bookings.`);
  process.exit(1);
}
console.log("Reconciliation balanced.");
```

- [ ] **Step 2: Verify it parses**

Run: `node --check scripts/backfill-students.mjs`
Expected: no output, exit 0

**Named deviation from the spec.** Spec §12 lists the backfill reconciliation as a Vitest
case. It is not unit-tested here: the script is a standalone one-shot operational `.mjs` with
its own inlined normalizers, and wrapping it for Vitest would mean restructuring a file that
runs exactly once. Its correctness is proven by running it against production and reading the
report. The normalization logic it duplicates **is** unit-tested, in Task 2. If this script
ever becomes something run repeatedly, it should import from `src/lib/students.ts` and get
real tests.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-students.mjs
git commit -m "feat(students): add one-time booking backfill with reconciliation report"
```

---

### Task 5: Review domain library

**Files:**
- Create: `src/lib/reviews.ts`
- Test: `src/lib/reviews.test.ts`

**Interfaces:**
- Produces:
  - `generateReviewToken(): string`
  - `hashReviewToken(token: string): string`
  - `type ReviewInput = { rating: unknown; body?: unknown; displayName: unknown; consent: unknown }`
  - `validateReviewInput(input: ReviewInput): { ok: true; value: { rating: number; body: string | null; displayName: string } } | { ok: false; error: string }`
  - `type ReviewEligibleBooking = { id: string; student_id: string | null; status: string; lesson_date: string; lesson_time: string; review_request_sent_at: string | null }`
  - `isEligibleForReviewRequest(booking: ReviewEligibleBooking, now: Date): { eligible: boolean; reason?: string }`
  - `defaultDisplayName(fullName: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/reviews.test.ts
import { describe, it, expect } from "vitest";
import {
  generateReviewToken,
  hashReviewToken,
  validateReviewInput,
  isEligibleForReviewRequest,
  defaultDisplayName,
} from "./reviews";

describe("review tokens", () => {
  it("generates distinct urlsafe tokens", () => {
    const a = generateReviewToken();
    const b = generateReviewToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });
  it("hashes deterministically and does not return the raw token", () => {
    const t = generateReviewToken();
    expect(hashReviewToken(t)).toBe(hashReviewToken(t));
    expect(hashReviewToken(t)).not.toBe(t);
  });
});

describe("defaultDisplayName", () => {
  it("renders first name plus last initial", () => {
    expect(defaultDisplayName("Rachel Kim")).toBe("Rachel K.");
  });
  it("passes through a single name", () => {
    expect(defaultDisplayName("Rachel")).toBe("Rachel");
  });
});

describe("validateReviewInput", () => {
  it("accepts a valid submission", () => {
    const r = validateReviewInput({ rating: 5, body: "Great lesson", displayName: "Rachel K.", consent: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.rating).toBe(5);
  });
  it("accepts an empty body", () => {
    const r = validateReviewInput({ rating: 4, body: "", displayName: "Rachel K.", consent: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBeNull();
  });
  it("rejects a missing or false consent", () => {
    expect(validateReviewInput({ rating: 5, displayName: "R", consent: false }).ok).toBe(false);
    expect(validateReviewInput({ rating: 5, displayName: "R", consent: undefined }).ok).toBe(false);
  });
  it("rejects an out-of-range rating", () => {
    expect(validateReviewInput({ rating: 0, displayName: "R", consent: true }).ok).toBe(false);
    expect(validateReviewInput({ rating: 6, displayName: "R", consent: true }).ok).toBe(false);
    expect(validateReviewInput({ rating: "5", displayName: "R", consent: true }).ok).toBe(false);
  });
  it("rejects an empty display name and an overlong body", () => {
    expect(validateReviewInput({ rating: 5, displayName: "   ", consent: true }).ok).toBe(false);
    expect(validateReviewInput({ rating: 5, body: "x".repeat(2001), displayName: "R", consent: true }).ok).toBe(false);
  });
});

describe("isEligibleForReviewRequest", () => {
  const now = new Date("2026-07-25T18:00:00Z");
  const base = {
    id: "b1",
    student_id: "s1",
    status: "confirmed",
    lesson_date: "2026-07-23",
    lesson_time: "10:00 AM",
    review_request_sent_at: null,
  };

  it("is eligible more than 24h after the lesson", () => {
    expect(isEligibleForReviewRequest(base, now).eligible).toBe(true);
  });
  it("is not eligible within 24h of the lesson", () => {
    expect(isEligibleForReviewRequest({ ...base, lesson_date: "2026-07-25" }, now).eligible).toBe(false);
  });
  it("excludes cancelled and no_show bookings", () => {
    expect(isEligibleForReviewRequest({ ...base, status: "cancelled" }, now).eligible).toBe(false);
    expect(isEligibleForReviewRequest({ ...base, status: "no_show" }, now).eligible).toBe(false);
  });
  it("excludes a booking already asked", () => {
    expect(isEligibleForReviewRequest({ ...base, review_request_sent_at: "2026-07-24T00:00:00Z" }, now).eligible).toBe(false);
  });
  it("excludes a booking with no student", () => {
    expect(isEligibleForReviewRequest({ ...base, student_id: null }, now).eligible).toBe(false);
  });
  it("gives a reason for every exclusion", () => {
    const r = isEligibleForReviewRequest({ ...base, status: "cancelled" }, now);
    expect(r.reason).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test -- src/lib/reviews.test.ts`
Expected: FAIL — cannot find module `./reviews`

- [ ] **Step 3: Implement**

```ts
// src/lib/reviews.ts
import { createHash, randomBytes } from "node:crypto";

const REVIEW_WINDOW_HOURS = 24;

export function generateReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashReviewToken(token: string): string {
  const salt = process.env.RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "demario-pickleball";
  return createHash("sha256").update(`${salt}:review:${token}`).digest("hex");
}

export function defaultDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export interface ReviewInput {
  rating: unknown;
  body?: unknown;
  displayName: unknown;
  consent: unknown;
}

export type ReviewValidation =
  | { ok: true; value: { rating: number; body: string | null; displayName: string } }
  | { ok: false; error: string };

export function validateReviewInput(input: ReviewInput): ReviewValidation {
  if (input.consent !== true) {
    return { ok: false, error: "Consent to publish is required" };
  }
  if (typeof input.rating !== "number" || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "Rating must be a whole number from 1 to 5" };
  }
  if (typeof input.displayName !== "string" || !input.displayName.trim() || input.displayName.length > 80) {
    return { ok: false, error: "Invalid display name" };
  }
  let body: string | null = null;
  if (input.body !== undefined && input.body !== null && input.body !== "") {
    if (typeof input.body !== "string" || input.body.length > 2000) {
      return { ok: false, error: "Review is too long" };
    }
    body = input.body.trim() || null;
  }
  return { ok: true, value: { rating: input.rating, body, displayName: input.displayName.trim() } };
}

export interface ReviewEligibleBooking {
  id: string;
  student_id: string | null;
  status: string;
  lesson_date: string;
  lesson_time: string;
  review_request_sent_at: string | null;
}

export function isEligibleForReviewRequest(
  booking: ReviewEligibleBooking,
  now: Date
): { eligible: boolean; reason?: string } {
  if (booking.status !== "confirmed") {
    return { eligible: false, reason: `status is ${booking.status}` };
  }
  if (!booking.student_id) {
    return { eligible: false, reason: "no student record" };
  }
  if (booking.review_request_sent_at) {
    return { eligible: false, reason: "already asked" };
  }
  const lessonStart = new Date(`${booking.lesson_date}T00:00:00Z`);
  const hoursSince = (now.getTime() - lessonStart.getTime()) / 3_600_000;
  if (hoursSince < REVIEW_WINDOW_HOURS) {
    return { eligible: false, reason: "lesson is less than 24h old" };
  }
  return { eligible: true };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/lib/reviews.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/reviews.ts src/lib/reviews.test.ts
git commit -m "feat(reviews): add review token, validation, and cron eligibility logic"
```

---

### Task 6: Public review submission API

**Files:**
- Create: `src/app/api/reviews/route.ts`

**Interfaces:**
- Consumes: `validateReviewInput`, `hashReviewToken` (Task 5); `findOrCreateStudent`, `normalizePhone`, `normalizeEmail` (Task 2); `checkRateLimit`, `hashRequestIp`; `createServiceRoleClient`, `requireAdmin`
- Produces: `POST /api/reviews` (public), `GET /api/reviews?status=pending` (admin)

Follows the existing public-POST pattern exactly: honeypot, then rate limit, then validation, then write.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, requireAdmin } from "@/lib/supabase/server";
import { checkRateLimit, hashRequestIp } from "@/lib/rate-limit";
import { validateReviewInput, hashReviewToken } from "@/lib/reviews";
import { findOrCreateStudent } from "@/lib/students";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Honeypot, same field name as the contact form.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "reviews",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  const validation = validateReviewInput({
    rating: body.rating,
    body: body.body,
    displayName: body.displayName,
    consent: body.consent,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { rating, body: text, displayName } = validation.value;

  // Tokenized path: the token identifies an already-created pending row.
  if (typeof body.token === "string" && body.token) {
    const tokenHash = hashReviewToken(body.token);
    const { data: pending, error: findError } = await supabase
      .from("reviews")
      .select("id,token_used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (findError) {
      console.error("[reviews POST] token lookup failed", findError);
      return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
    }
    if (!pending) {
      return NextResponse.json({ error: "This review link is not valid" }, { status: 404 });
    }
    if (pending.token_used_at) {
      return NextResponse.json({ error: "This review was already submitted" }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        rating,
        body: text,
        display_name: displayName,
        consent_publish: true,
        token_used_at: new Date().toISOString(),
        submitted_ip_hash: hashRequestIp(req),
      })
      .eq("id", pending.id);

    if (updateError) {
      console.error("[reviews POST] token submit failed", updateError);
      return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, verified: true }, { status: 201 });
  }

  // Public path: unverified, matched to a student when contact details allow.
  let studentId: string | null = null;
  if (typeof body.contact === "string" && body.contact.trim()) {
    const contact = body.contact.trim();
    const looksLikeEmail = contact.includes("@");
    const match = await findOrCreateStudent(supabase, {
      name: displayName,
      email: looksLikeEmail ? contact : "",
      phone: looksLikeEmail ? "" : contact,
      source: "import",
    });
    studentId = match?.student.id ?? null;
  }

  const { error: insertError } = await supabase.from("reviews").insert({
    student_id: studentId,
    rating,
    body: text,
    display_name: displayName,
    consent_publish: true,
    verified_booking: false,
    source: "site",
    status: "pending",
    submitted_ip_hash: hashRequestIp(req),
  });

  if (insertError) {
    console.error("[reviews POST] insert failed", insertError);
    return NextResponse.json({ error: "Could not save your review" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, verified: false }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const status = req.nextUrl.searchParams.get("status");
  let query = admin.supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && ["pending", "published", "hidden"].includes(status)) {
    query = query.eq("status", status);
  }
  // Only show rows the student actually submitted. A tokenized row created by the cron
  // carries placeholder values until it is filled in, so it must stay out of the queue
  // until token_used_at is stamped. Public submissions have no token at all.
  query = query.or("token_hash.is.null,token_used_at.not.is.null");

  const { data, error } = await query;
  if (error) {
    console.error("[reviews GET]", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reviews/route.ts
git commit -m "feat(reviews): add public review submission and admin list API"
```

---

### Task 7: Review pages and shared form

**Files:**
- Create: `src/components/ReviewForm.tsx`
- Create: `src/app/review/page.tsx`
- Create: `src/app/review/[token]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/reviews` (Task 6); `hashReviewToken` (Task 5)
- Produces: `<ReviewForm token?: string, lessonLabel?: string, defaultName?: string />`

- [ ] **Step 1: Write the shared form component**

```tsx
// src/components/ReviewForm.tsx
"use client";

import { useState } from "react";

interface ReviewFormProps {
  token?: string;
  lessonLabel?: string;
  defaultName?: string;
}

export default function ReviewForm({ token, lessonLabel, defaultName }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [displayName, setDisplayName] = useState(defaultName ?? "");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const googleUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rating,
        body: text,
        displayName,
        contact: token ? undefined : contact,
        consent,
        company,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setState("error");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="review-done">
        <h2>Thank you.</h2>
        <p>Your review is with DeMario for approval. It will appear on the site once he publishes it.</p>
        {googleUrl && text.trim() && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(text);
              window.open(googleUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Post this to Google too
          </button>
        )}
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={submit}>
      {lessonLabel && <p className="review-lesson">Reviewing: {lessonLabel}</p>}

      <fieldset className="review-rating">
        <legend>How was it?</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            className={rating >= n ? "star on" : "star"}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </fieldset>

      <label>
        Anything you want to add? (optional)
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} />
      </label>

      <label>
        How your name should appear
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} required />
      </label>

      {!token && (
        <label>
          Your email or phone (so DeMario knows who you are)
          <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={254} />
        </label>
      )}

      <label className="review-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        I am ok with DeMario publishing this on his website.
      </label>

      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px" }}
      />

      {error && <p className="review-error">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={state === "sending" || rating === 0 || !consent}>
        {state === "sending" ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Write the public page**

```tsx
// src/app/review/page.tsx
import type { Metadata } from "next";
import ReviewForm from "@/components/ReviewForm";

export const metadata: Metadata = {
  title: "Leave a review · DeMario Montez Pickleball",
  description: "Share your experience training with DeMario Montez.",
  robots: { index: false, follow: false },
};

export default function PublicReviewPage() {
  return (
    <main className="review-page">
      <h1>How was your lesson?</h1>
      <p>Took a lesson, clinic, or drilling session with DeMario? Tell him how it went.</p>
      <ReviewForm />
    </main>
  );
}
```

- [ ] **Step 3: Write the tokenized page**

```tsx
// src/app/review/[token]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/ReviewForm";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hashReviewToken } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Leave a review · DeMario Montez Pickleball",
  robots: { index: false, follow: false },
};

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

export default async function TokenReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: review } = await supabase
    .from("reviews")
    .select("id,token_used_at,display_name,booking_id")
    .eq("token_hash", hashReviewToken(token))
    .maybeSingle();

  if (!review) notFound();

  if (review.token_used_at) {
    return (
      <main className="review-page">
        <h1>Thank you.</h1>
        <p>You have already left this review. DeMario has it.</p>
      </main>
    );
  }

  let lessonLabel: string | undefined;
  if (review.booking_id) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("lesson_type,lesson_date")
      .eq("id", review.booking_id)
      .maybeSingle();
    if (booking) {
      const name = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;
      lessonLabel = `${name} on ${booking.lesson_date}`;
    }
  }

  return (
    <main className="review-page">
      <h1>How was your lesson?</h1>
      <ReviewForm token={token} lessonLabel={lessonLabel} defaultName={review.display_name} />
    </main>
  );
}
```

- [ ] **Step 4: Add the styles**

Append to `src/app/globals.css`. Every value below comes from the existing `:root` custom
properties (`--bg`, `--bg-2`, `--bg-3`, `--line`, `--fg`, `--fg-dim`, `--fg-muted`,
`--accent`, `--accent-ink`, `--danger`, `--radius`). Introduce no new color literals.

```css
/* Review capture pages */
.review-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 6rem 1.25rem 4rem;
}
.review-page h1 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  margin-bottom: 0.5rem;
}
.review-page > p {
  color: var(--fg-dim);
  margin-bottom: 2rem;
}
.review-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.review-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--fg-dim);
  font-size: 0.9rem;
}
.review-form input[type="text"],
.review-form input:not([type]),
.review-form textarea {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--fg);
  padding: 0.75rem 0.9rem;
  font: inherit;
  width: 100%;
}
.review-form textarea { resize: vertical; }
.review-lesson {
  color: var(--fg-muted);
  font-size: 0.85rem;
  margin: 0;
}
.review-rating {
  border: 0;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.review-rating legend {
  color: var(--fg-dim);
  font-size: 0.9rem;
  margin-bottom: 0.4rem;
}
.star {
  background: none;
  border: 0;
  cursor: pointer;
  font-size: 2rem;
  line-height: 1;
  color: var(--line);
  padding: 0 0.1rem;
  transition: color 120ms ease;
}
.star.on { color: var(--accent); }
.star:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.review-consent {
  flex-direction: row;
  align-items: flex-start;
  gap: 0.6rem;
  color: var(--fg);
}
.review-consent input { margin-top: 0.2rem; }
.review-error { color: var(--danger); font-size: 0.9rem; }
.review-done {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 2rem;
}
.review-done h2 { margin-bottom: 0.5rem; }
.review-done p { color: var(--fg-dim); margin-bottom: 1.25rem; }
```

The star buttons are the one place worth checking on a phone: they must stay at least 44px of
tappable height. Bump the `font-size` or add padding if they come in under that.

- [ ] **Step 5: Verify the pages build**

Run: `npm run build`
Expected: `/review` and `/review/[token]` appear in the route output

- [ ] **Step 6: Commit**

```bash
git add src/components/ReviewForm.tsx src/app/review src/app/globals.css
git commit -m "feat(reviews): add public and tokenized review submission pages"
```

---

### Task 8: Admin moderation

**Files:**
- Create: `src/app/api/reviews/[id]/route.ts`
- Create: `src/app/admin/(protected)/reviews/page.tsx`
- Create: `src/components/ReviewsDashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/reviews?status=` (Task 6), `requireAdmin`
- Produces: `PATCH /api/reviews/[id]` with `{ status: "published" | "hidden" }`, `DELETE /api/reviews/[id]`

**There is deliberately no route or UI that edits `body` or `rating`.**

- [ ] **Step 1: Write the moderation API**

```ts
// src/app/api/reviews/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { status } = body;
  // Publish and hide only. Review text is never editable through this API.
  if (!["published", "hidden"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("reviews")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[reviews PATCH]", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const { error } = await admin.supabase.from("reviews").delete().eq("id", id);
  if (error) {
    console.error("[reviews DELETE]", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the dashboard component**

`TasksDashboard` takes its data as an `initialTasks` prop from a server page rather than
fetching on mount. Follow that pattern. It also defines a local `responseError` helper — reuse
that shape.

```tsx
// src/components/ReviewsDashboard.tsx
"use client";

import { useMemo, useState } from "react";

interface Review {
  id: string;
  rating: number;
  body: string | null;
  display_name: string;
  lesson_context: string | null;
  tag: string | null;
  takeaway: string | null;
  verified_booking: boolean;
  status: "pending" | "published" | "hidden";
  created_at: string;
  published_at: string | null;
}

interface Props {
  initialReviews: Review[];
}

async function responseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

const FILTERS = ["pending", "published", "hidden"] as const;

export default function ReviewsDashboard({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visible = useMemo(
    () => reviews.filter((r) => r.status === filter),
    [reviews, filter]
  );

  async function setStatus(id: string, status: "published" | "hidden") {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError(await responseError(res, "Could not update that review."));
      setBusy(null);
      return;
    }
    const updated: Review = await res.json();
    setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setBusy(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy(id);
    setError("");
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await responseError(res, "Could not delete that review."));
      setBusy(null);
      return;
    }
    setReviews((prev) => prev.filter((r) => r.id !== id));
    setBusy(null);
  }

  return (
    <div className="admin-panel">
      <div className="admin-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)} ({reviews.filter((r) => r.status === f).length})
          </button>
        ))}
      </div>

      {error && <p className="admin-error">{error}</p>}

      {visible.length === 0 && (
        <p className="admin-empty">
          {filter === "pending"
            ? "No reviews waiting. New ones show up here after a student submits."
            : `No ${filter} reviews.`}
        </p>
      )}

      {visible.map((r) => (
        <article className="review-row" key={r.id}>
          <header>
            <span className="review-stars" aria-label={`${r.rating} out of 5`}>
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </span>
            <span className={r.verified_booking ? "badge verified" : "badge unverified"}>
              {r.verified_booking ? "Verified booking" : "Unverified"}
            </span>
            <time dateTime={r.created_at}>
              {new Date(r.created_at).toLocaleDateString()}
            </time>
          </header>

          {r.body && <p className="review-body">{r.body}</p>}

          <p className="review-meta">
            {r.display_name}
            {r.lesson_context ? ` · ${r.lesson_context}` : ""}
          </p>

          <div className="review-actions">
            {r.status !== "published" && (
              <button type="button" disabled={busy === r.id} onClick={() => setStatus(r.id, "published")}>
                Publish
              </button>
            )}
            {r.status !== "hidden" && (
              <button type="button" disabled={busy === r.id} onClick={() => setStatus(r.id, "hidden")}>
                Hide
              </button>
            )}
            <button type="button" className="danger" disabled={busy === r.id} onClick={() => remove(r.id)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
```

There is no edit control anywhere in this component. That is deliberate. Do not add one.

Reuse the real class names from `TasksDashboard.tsx` and `src/app/globals.css` in place of
`admin-panel`, `admin-filters`, `admin-error`, and `admin-empty` if the existing names differ.

- [ ] **Step 3: Write the admin page**

```tsx
// src/app/admin/(protected)/reviews/page.tsx
import ReviewsDashboard from "@/components/ReviewsDashboard";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata = { title: "Reviews · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  // The (protected) layout already enforces session + AAL2 before this renders.
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .or("token_hash.is.null,token_used_at.not.is.null")
    .order("created_at", { ascending: false });

  return <ReviewsDashboard initialReviews={data ?? []} />;
}
```

- [ ] **Step 4: Add the nav link**

Open `src/app/admin/(protected)/layout.tsx`, find the existing admin nav links (Bookings, Tasks, Business, Site), and add a Reviews link alongside them using the identical markup and class names.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: no errors, `/admin/reviews` in the route output

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/reviews/[id]/route.ts" "src/app/admin/(protected)/reviews" src/components/ReviewsDashboard.tsx "src/app/admin/(protected)/layout.tsx"
git commit -m "feat(admin): add review moderation queue with publish, hide, and delete"
```

---

### Task 9: Published reviews on the homepage

**Files:**
- Create: `src/app/api/reviews/published/route.ts`
- Modify: `src/components/Testimonials.tsx`
- Modify: `src/lib/data.ts` (delete `REVIEWS` and the `Review` interface)
- Modify: `src/lib/data.test.ts` (drop `REVIEWS` assertions)

**Interfaces:**
- Consumes: `reviews` table
- Produces: `GET /api/reviews/published` returning `{ id, rating, body, display_name, lesson_context, verified_booking, published_at }[]`

- [ ] **Step 1: Write the public endpoint**

```ts
// src/app/api/reviews/published/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id,rating,body,display_name,lesson_context,tag,takeaway,verified_booking,published_at")
    .eq("status", "published")
    .not("body", "is", null)
    .order("verified_booking", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[reviews published GET]", error);
    return NextResponse.json([], { status: 200 });
  }
  return NextResponse.json(data ?? []);
}
```

Returning `[]` on error is deliberate: a database hiccup must not break the homepage. The error is still logged and reaches Sentry.

- [ ] **Step 2: Read the current Testimonials component**

Run: `cat src/components/Testimonials.tsx`

It renders **two** hardcoded sets, not one: the `REVIEWS` carousel (fields `quote`,
`accentWord`, `name`, `meta`, `initial`, `tag`, `takeaway`) and a separate `REVIEW_WALL`
constant of four more (fields `quote`, `name`, `focus`). Both are replaced. `PROOF_POINTS`
stays exactly as it is — those are marketing copy, not testimonials.

Field mapping: `body` → `quote`, `display_name` → `name`, `lesson_context` → `meta` and
`focus`, `tag` → `tag`, `takeaway` → `takeaway`, `initial` derived from `display_name`.
`accentWord` is dropped — it is pure decoration with no database equivalent, so
`renderQuote` and its `.accent` span go away.

- [ ] **Step 3: Rewrite Testimonials to fetch**

Keep every existing class name and the surrounding markup. The only structural changes are
the data source, the removal of `renderQuote`, and the empty-state guards.

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PublishedReview {
  id: string;
  rating: number;
  body: string | null;
  display_name: string;
  lesson_context: string | null;
  tag: string | null;
  takeaway: string | null;
  verified_booking: boolean;
}

// PROOF_POINTS stays exactly as it is today. Do not change it.
```

Inside the component:

```tsx
  const [reviews, setReviews] = useState<PublishedReview[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reviews/published")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublishedReview[]) => {
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A takeaway is Mario's signal that a review belongs in the featured carousel.
  const featured = reviews.filter((r) => r.takeaway);
  const wall = reviews.filter((r) => !r.takeaway);
  const r = featured[idx] ?? null;
```

Fix the rotation to guard against an empty list and reset when the list length changes:

```tsx
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (featured.length < 2) return;
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setIdx((prev) => (prev + 1) % featured.length);
      }
    }, 6000);
  }, [featured.length]);

  useEffect(() => {
    setIdx(0);
  }, [featured.length]);
```

Render the featured card only when `r` exists, and the wall only when `wall.length > 0`:

```tsx
        {r && (
          <div className="featured-review">
            {r.tag && <div className="review-tag">{r.tag}</div>}
            <Stars count={r.rating} />
            <p className="featured-quote">&ldquo;{r.body}&rdquo;</p>
            <div className="review-author">
              <div className="avatar">{r.display_name.trim().charAt(0).toUpperCase()}</div>
              <div>
                <div className="author-name">{r.display_name}</div>
                {r.lesson_context && <div className="author-meta">{r.lesson_context}</div>}
              </div>
            </div>
            {r.takeaway && (
              <div className="review-takeaway">
                <span>Lesson impact</span>
                <strong>{r.takeaway}</strong>
              </div>
            )}
            {featured.length > 1 && (
              <div className="review-pager">
                {featured.map((review, i) => (
                  <button
                    key={review.id}
                    type="button"
                    className={i === idx ? "active" : ""}
                    onClick={() => goReview(i)}
                    aria-label={`Review ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
```

```tsx
        {wall.length > 0 && (
          <div className="small-reviews">
            {wall.map((review) => (
              <div className="small-review" key={review.id}>
                <div className="mini-review-head">
                  <Stars count={review.rating} />
                  {review.lesson_context && <span>{review.lesson_context}</span>}
                </div>
                <div>&ldquo;{review.body}&rdquo;</div>
                <div className="name">— {review.display_name}</div>
              </div>
            ))}
          </div>
        )}
```

`Stars` currently hardcodes five. Make it honest about the rating:

```tsx
const Stars = ({ count = 5 }: { count?: number }) => (
  <div className="stars">
    {[...Array(count)].map((_, i) => (
      <svg key={i} viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);
```

The section header, `PROOF_POINTS` panel, and the closing CTA button render unconditionally.
They carry their own value and must not disappear when the review list is empty.

- [ ] **Step 4: Delete the constant**

Remove the `Review` interface and the `REVIEWS` constant from `src/lib/data.ts`. Leave `LESSONS`, `LessonStep`, `Lesson`, `LessonKey`, `DaySlot`, and `generateDays` untouched. Remove any `REVIEWS` assertions from `src/lib/data.test.ts`.

- [ ] **Step 5: Verify nothing still imports REVIEWS**

Run: `grep -rn "REVIEWS" src/`
Expected: no results

- [ ] **Step 6: Run the full suite**

Run: `npm run ci`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/reviews/published/route.ts src/components/Testimonials.tsx src/lib/data.ts src/lib/data.test.ts
git commit -m "feat(reviews): render published reviews on the homepage and retire the static list"
```

---

### Task 10: Review request email

**Files:**
- Modify: `src/lib/email/templates.ts`
- Modify: `src/lib/email/client.ts`

**Interfaces:**
- Produces:
  - `reviewRequestHtml(args: { name: string; lessonName: string; lessonDate: string; reviewUrl: string }): string`
  - `sendReviewRequestEmail(args: { to: string; name: string; lessonName: string; lessonDate: string; reviewUrl: string }): Promise<boolean>`

- [ ] **Step 1: Read an existing template**

Run: `sed -n '18,75p' src/lib/email/templates.ts`

The file already has a private `wrap(inner: string, heading: string): string` helper and a
private `escapeHtml(s: string): string` helper. Both are module-scoped, so the new template
appended to the same file can call them directly. Copy the markup, inline styles, and tone of
`studentRequestedHtml` exactly. Do not invent a new email design.

- [ ] **Step 2: Add the template**

Append to `src/lib/email/templates.ts`, matching the surrounding style. Note `wrap` takes two
arguments — the inner HTML and the heading:

```ts
export function reviewRequestHtml({
  name,
  lessonName,
  lessonDate,
  reviewUrl,
}: {
  name: string;
  lessonName: string;
  lessonDate: string;
  reviewUrl: string;
}): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return wrap(
    `
    <p>Hey ${escapeHtml(first)},</p>
    <p>Thanks for training with me on ${escapeHtml(lessonDate)} — I hope the ${escapeHtml(lessonName)} session gave you something to work on.</p>
    <p>If you have a minute, I would appreciate a quick review. It takes about thirty seconds and it helps other players find me.</p>
    <p><a href="${reviewUrl}">Leave a review</a></p>
    <p>See you on the court.<br/>DeMario</p>
  `,
    "How was your lesson?"
  );
}
```

Match the anchor styling `studentRequestedHtml` uses for its call-to-action link rather than
assuming a `class="btn"` exists in the email CSS.

- [ ] **Step 3: Add the send function**

Append to `src/lib/email/client.ts`, following the existing graceful-skip and error-logging pattern. It returns a boolean so the cron can count failures:

```ts
export async function sendReviewRequestEmail({
  to,
  name,
  lessonName,
  lessonDate,
  reviewUrl,
}: {
  to: string;
  name: string;
  lessonName: string;
  lessonDate: string;
  reviewUrl: string;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping review request");
    return false;
  }
  const result = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: `How was your lesson, ${name.trim().split(/\s+/)[0] || "there"}?`,
    html: reviewRequestHtml({ name, lessonName, lessonDate, reviewUrl }),
    replyTo: adminEmail(),
  });
  if (result.error) {
    console.error("[email] review request failed", result.error);
    return false;
  }
  return true;
}
```

Add `reviewRequestHtml` to the existing import from `./templates`.

- [ ] **Step 4: Add a template test**

Append to `src/lib/email/templates.test.ts`:

```ts
import { reviewRequestHtml } from "./templates";

describe("reviewRequestHtml", () => {
  it("includes the review link and the lesson details", () => {
    const html = reviewRequestHtml({
      name: "Rachel Kim",
      lessonName: "Foundations",
      lessonDate: "2026-07-23",
      reviewUrl: "https://demariomontezpb.com/review/abc123",
    });
    expect(html).toContain("https://demariomontezpb.com/review/abc123");
    expect(html).toContain("Foundations");
    expect(html).toContain("Rachel");
  });
  it("escapes a name containing markup", () => {
    const html = reviewRequestHtml({
      name: "<script>alert(1)</script>",
      lessonName: "Foundations",
      lessonDate: "2026-07-23",
      reviewUrl: "https://example.com/review/x",
    });
    expect(html).not.toContain("<script>");
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm run test -- src/lib/email/templates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/templates.ts src/lib/email/client.ts src/lib/email/templates.test.ts
git commit -m "feat(email): add the post-lesson review request template and sender"
```

---

### Task 11: Review request cron

**Files:**
- Create: `src/app/api/cron/review-requests/route.ts`
- Create: `vercel.json`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `isEligibleForReviewRequest`, `generateReviewToken`, `hashReviewToken`, `defaultDisplayName` (Task 5); `sendReviewRequestEmail` (Task 10); `SITE_URL` from `@/lib/site`
- Produces: `GET /api/cron/review-requests` returning `{ sent, skipped, failed }`

Verified 2026-07-25: `vercel.json` `crons` is the current supported configuration surface, Hobby plans allow a once-per-day minimum interval, and Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`.

- [ ] **Step 1: Write the cron route**

```ts
// src/app/api/cron/review-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  isEligibleForReviewRequest,
  generateReviewToken,
  hashReviewToken,
  defaultDisplayName,
} from "@/lib/reviews";
import { sendReviewRequestEmail } from "@/lib/email/client";
import { SITE_URL } from "@/lib/site";

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

const REASK_WINDOW_DAYS = 90;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const lookback = new Date(now.getTime() - 30 * 24 * 3_600_000).toISOString().slice(0, 10);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id,name,email,status,lesson_type,lesson_date,lesson_time,student_id,review_request_sent_at")
    .gte("lesson_date", lookback)
    .is("review_request_sent_at", null);

  if (error) {
    console.error("[cron review-requests] booking query failed", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  const skipped: Record<string, number> = {};
  const failed: string[] = [];

  for (const booking of bookings ?? []) {
    const eligibility = isEligibleForReviewRequest(booking, now);
    if (!eligibility.eligible) {
      const reason = eligibility.reason ?? "unknown";
      skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }

    // Do not ask the same person twice in a quarter.
    const since = new Date(now.getTime() - REASK_WINDOW_DAYS * 24 * 3_600_000).toISOString();
    const { data: recent } = await supabase
      .from("reviews")
      .select("id")
      .eq("student_id", booking.student_id)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      skipped["asked within 90 days"] = (skipped["asked within 90 days"] ?? 0) + 1;
      continue;
    }

    const token = generateReviewToken();
    const { error: createError } = await supabase.from("reviews").insert({
      student_id: booking.student_id,
      booking_id: booking.id,
      rating: 5,
      display_name: defaultDisplayName(booking.name),
      consent_publish: true,
      verified_booking: true,
      source: "site",
      status: "pending",
      token_hash: hashReviewToken(token),
    });

    if (createError) {
      console.error("[cron review-requests] review row failed", booking.id, createError);
      failed.push(booking.id);
      continue;
    }

    const ok = await sendReviewRequestEmail({
      to: booking.email,
      name: booking.name,
      lessonName: LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type,
      lessonDate: booking.lesson_date,
      reviewUrl: `${SITE_URL}/review/${token}`,
    });

    if (!ok) {
      failed.push(booking.id);
      continue;
    }

    const { error: stampError } = await supabase
      .from("bookings")
      .update({ review_request_sent_at: now.toISOString() })
      .eq("id", booking.id);
    if (stampError) {
      console.error("[cron review-requests] stamp failed", booking.id, stampError);
      failed.push(booking.id);
      continue;
    }
    sent++;
  }

  // Failures are named, never swallowed.
  if (failed.length > 0) {
    console.error("[cron review-requests] failed bookings", failed);
  }
  return NextResponse.json({ sent, skipped, failed });
}
```

The seeded `rating: 5` and `display_name` are placeholders on a row that is not yet submittable — `token_used_at` is null and the admin list filters to submitted rows. The student's real rating and name overwrite them on submit.

- [ ] **Step 2: Add the cron configuration**

```json
{
  "crons": [
    {
      "path": "/api/cron/review-requests",
      "schedule": "0 15 * * *"
    }
  ]
}
```

`0 15 * * *` is 15:00 UTC, which is 10am Central. Vercel may fire anywhere within that hour, which is fine for this job.

- [ ] **Step 3: Document the new variables**

Add to `.env.local.example`, matching the file's existing comment style:

```bash
# Protects /api/cron/review-requests. Vercel sends this as an Authorization Bearer header.
CRON_SECRET=
# Google Business Profile review link. Leave empty until the profile exists; the button stays hidden.
NEXT_PUBLIC_GOOGLE_REVIEW_URL=
```

- [ ] **Step 4: Verify the auth gate manually**

Run: `npm run dev`, then in another shell:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/review-requests
```

Expected: `401`

- [ ] **Step 5: Full CI**

Run: `npm run ci`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/review-requests/route.ts vercel.json .env.local.example
git commit -m "feat(reviews): add the daily review request cron"
```

---

### Task 12: Film Room

**Files:**
- Create: `src/lib/videos.ts`
- Create: `src/components/FilmRoom.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `type Clip = { id: string; concept: string; watchFor: string; src: string; poster: string }`, `CLIPS: Clip[]`

- [ ] **Step 1: Create the clip data module**

```ts
// src/lib/videos.ts
export interface Clip {
  id: string;
  concept: string;
  watchFor: string;
  src: string;
  poster: string;
}

// Clips are curated by hand. Files live in public/video/ and public/img/.
// Empty until DeMario sends the files; the section hides itself when this is empty.
export const CLIPS: Clip[] = [];
```

- [ ] **Step 2: Write the component**

```tsx
// src/components/FilmRoom.tsx
import RevealWrapper from "./RevealWrapper";
import { CLIPS } from "@/lib/videos";

export default function FilmRoom() {
  if (CLIPS.length === 0) return null;

  return (
    <section className="filmroom" id="filmroom">
      <RevealWrapper>
        <h2 className="section-title">Film room</h2>
        <p className="section-sub">
          The shots we work on, and what to watch for in each one.
        </p>
        <div className="clip-grid">
          {CLIPS.map((clip) => (
            <figure className="clip" key={clip.id}>
              <video
                src={clip.src}
                poster={clip.poster}
                preload="none"
                playsInline
                muted
                controls
              />
              <figcaption>
                <span className="clip-concept">{clip.concept}</span>
                <span className="clip-watch">{clip.watchFor}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </RevealWrapper>
    </section>
  );
}
```

- [ ] **Step 3: Mount it on the homepage**

In `src/app/page.tsx`, import `FilmRoom` and render it directly after `<ImproveGrid />` and before `<Philosophy />`. That places the proof-of-teaching next to the areas-of-focus grid it illustrates.

- [ ] **Step 4: Style it**

Append to `src/app/globals.css`. Check the existing `.block` and `.improve-grid` rules first
and match their section padding and breakpoint values rather than the placeholders here.

```css
/* Film room */
.filmroom { padding: 5rem 0; }
.clip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  margin-top: 2.5rem;
}
.clip {
  margin: 0;
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}
.clip video {
  display: block;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 9 / 16;
  object-fit: cover;
  background: var(--bg-3);
}
.clip figcaption {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 1rem;
}
.clip-concept {
  color: var(--fg);
  font-weight: 600;
}
.clip-watch {
  color: var(--fg-dim);
  font-size: 0.9rem;
}
```

`aspect-ratio: 9 / 16` assumes vertical phone clips, which is what Instagram exports. If
DeMario sends landscape footage, change it to `16 / 9` rather than letting the poster frames
crop badly.

- [ ] **Step 5: Verify**

Run: `npm run ci`
Expected: PASS. With `CLIPS` empty the section renders nothing, so the homepage is visually unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/videos.ts src/components/FilmRoom.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat(site): add the Film Room section, hidden until clips are added"
```

---

### Task 13: E2E coverage and documentation

**Files:**
- Create: `e2e/reviews.spec.ts`
- Modify: `docs/APP_OVERVIEW.md`
- Modify: `docs/DEVELOPER_PLAN.md`
- Modify: `docs/RELEASE_CHECKLIST.md`

- [ ] **Step 1: Read the existing e2e suite**

Run: `cat e2e/smoke.spec.ts`

Match its selector strategy, base URL handling, and assertion style.

- [ ] **Step 2: Write the review specs**

```ts
// e2e/reviews.spec.ts
import { test, expect } from "@playwright/test";

test("public review page renders the form", async ({ page }) => {
  await page.goto("/review");
  await expect(page.getByRole("heading", { name: /how was your lesson/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /5 stars/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /submit review/i })).toBeDisabled();
});

test("submit stays disabled until a rating and consent are given", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: /5 stars/i }).click();
  await expect(page.getByRole("button", { name: /submit review/i })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: /submit review/i })).toBeEnabled();
});

test("an unknown review token 404s", async ({ page }) => {
  const res = await page.goto("/review/not-a-real-token");
  expect(res?.status()).toBe(404);
});

test("admin reviews page redirects an unauthenticated visitor", async ({ page }) => {
  await page.goto("/admin/reviews");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("cron endpoint rejects an unauthenticated request", async ({ request }) => {
  const res = await request.get("/api/cron/review-requests");
  expect(res.status()).toBe(401);
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS. The unknown-token test needs a live Supabase connection; if the local environment has no Supabase credentials, note that explicitly in the run summary rather than deleting the test.

- [ ] **Step 4: Update APP_OVERVIEW.md**

Add to the existing tables and sections, matching their format:
- §3 repository layout: `src/app/review/`, `src/app/api/cron/`, `scripts/backfill-students.mjs`
- §4 homepage sections table: `FilmRoom`
- §7 public routes: `POST /api/reviews`, `GET /api/reviews/published`
- §7 admin routes: `GET /api/reviews`, `PATCH`/`DELETE /api/reviews/[id]`
- §7: a new cron row for `GET /api/cron/review-requests`
- §9 dashboard sections: Reviews
- §15 database schema: `students` and `reviews`, plus the new `bookings` columns
- §16 tests: the new unit and e2e files
- §17 environment variables: `CRON_SECRET`, `NEXT_PUBLIC_GOOGLE_REVIEW_URL`

- [ ] **Step 5: Update DEVELOPER_PLAN.md**

Add a "Shipped" subsection for this work. Move nothing out of Deferred P2 that was not actually built. Add to Remaining Manual Launch Gates:
- Run `docs/supabase-students-reviews-migration.sql` in the Supabase SQL Editor
- Run `node scripts/backfill-students.mjs` once and confirm the reconciliation balances
- Set `CRON_SECRET` in Vercel
- Confirm the cron appears in the Vercel project's Cron Jobs tab after deploy

- [ ] **Step 6: Update RELEASE_CHECKLIST.md**

Add verification steps: the migration is applied, the backfill balanced, a test review submits through `/review` and appears pending in admin, publishing it makes it appear on the homepage, and the cron endpoint returns 401 without the secret.

- [ ] **Step 7: Final full verification**

Run: `npm run ci && npm run test:e2e`
Expected: PASS. Report the actual output. If anything fails, say so plainly rather than describing the work as complete.

- [ ] **Step 8: Commit**

```bash
git add e2e/reviews.spec.ts docs/
git commit -m "test(reviews): add e2e coverage and update project documentation"
```

---

## Post-Implementation Manual Gates

These cannot be done from the repo and must be reported as outstanding, not as done.

1. Apply `docs/supabase-students-reviews-migration.sql` in the Supabase SQL Editor.
2. Run `node scripts/backfill-students.mjs` with production credentials. Confirm the reconciliation balances.
3. Set `CRON_SECRET` in the Vercel project and redeploy.
4. Confirm the cron is registered in the Vercel dashboard after deploy.
5. Submit one real review end to end and publish it from admin.
6. Leave `NEXT_PUBLIC_GOOGLE_REVIEW_URL` empty until DeMario has a Google Business Profile.

## Corrections Found While Writing This Plan

Two things the spec got wrong, both corrected above:

1. **There are seven hardcoded testimonials on the site, not three.** `Testimonials.tsx`
   carries a second constant, `REVIEW_WALL`, with four more (David L., Carlos M., Priya S.,
   Tom B.) alongside the three in `REVIEWS`. DeMario confirmed three as real and permissioned.
   The migration seeds all seven so the wall does not visibly shrink on deploy, **but the four
   wall entries are not yet confirmed.** If DeMario cannot vouch for them they must be deleted
   from the seed before the migration runs. This is a publish-consent question, not a code
   question.
2. **The featured carousel needs two fields the spec's schema did not have.** It renders a
   `tag` and a `takeaway` per review. Both are added to `reviews` as nullable columns that
   Mario fills in at publish time. They are his editorial labels, not the student's words, so
   this does not weaken the no-editing rule — there is still no way to alter `body` or
   `rating`. A non-null `takeaway` is what promotes a review into the carousel.

## Still Open

- The `5.0 ★ · 79 reviews` claim in `Hero.tsx` and `TrustBar.tsx` is untouched by this plan and remains unverified. It is waiting on DeMario.
- `src/lib/videos.ts` ships with an empty `CLIPS` array. The Film Room stays hidden until his Instagram files arrive.
- The four `REVIEW_WALL` testimonials need the same real-and-permissioned confirmation the first three got.
