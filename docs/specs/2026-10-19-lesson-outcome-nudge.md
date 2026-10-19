# Design: Lesson Outcome Nudge

Date: 2026-10-19. Branch: `feat/lesson-outcome-nudge`, stacked on `feat/conversion-tracking`.
Approved in scope by Tonio on 2026-10-19 ("morning-after email asking Mario to mark each lesson
done or no-show, which is what switches on review requests").

## 1. Why This Work

Measured against production Supabase on 2026-10-18 (aggregate queries only):

- 8 bookings ever, 2 of them April tests. 5 are still `pending`; 3 of those have lesson dates
  months in the past (2026-05-22, 2026-07-25, 2026-08-26).
- 1 booking has ever been `confirmed`. 0 are marked paid.
- `review_request_sent_at` is null on every booking: **the review loop shipped on 2026-07-28
  and has never sent a single request.**

The review cron only asks about a `confirmed` booking (`src/lib/reviews.ts`). Nothing in the
product moves a booking out of `pending` or tells Mario to. The admin email says "Text the
student to confirm the exact court" and never mentions the Confirm button. Mario does not open
`/admin`. The loop is built and tested, and it is starved of its one input.

## 2. Goal

The morning after a site-booked lesson, Mario gets one email. One tap records what happened.
Recording "Lesson happened" is all the existing review cron needs to send the student a review
request later that day or the next.

## 3. Locked Decisions

1. **One digest, only when needed.** At most one email a morning, listing every lesson that
   needs an outcome. No email on a day with nothing to record.
2. **Window: lessons dated 1–3 days ago (Central).** Each unrecorded lesson appears in up to three
   morning digests, then drops out of email and stays visible in Admin under "Needs outcome".
3. **Three outcomes.**

   | Tap | Status | Student hears |
   |---|---|---|
   | Lesson happened | `confirmed` | A review request from the existing cron |
   | No-show | `no_show` | Nothing |
   | Didn't happen | `cancelled` | Nothing |

   "Didn't happen" is silent on purpose. The lesson date has passed, and the Admin cancel path
   would email the student a cancellation for a lesson they already know about.
4. **Signed, narrow links.** Each link names one booking and one outcome, expires in 14 days,
   and can only move a booking **out of `pending`**. A recorded lesson cannot be flipped by a
   later or replayed link; changes after that go through Admin.
5. **No state change on GET.** A link opens a confirmation page. Only the button on that page
   (a form POST) records anything. Mail scanners (Outlook Safe Links, Gmail's link checks,
   corporate gateways) fetch every link in an email, so a GET that changed state would record
   an outcome Mario never chose.
6. **Inert until configured.** Without `LESSON_OUTCOME_SECRET`, the cron logs and returns 500
   and the link page says it is not set up. That is the same pattern as `CRON_SECRET`: a
   misconfigured job stays loud.

## 4. Limitations Check

- **Known ceiling:** it only sees lessons booked through this site. Most of Mario's lessons are
  booked on TeachMe.To and PodPlay and never enter this database, so the review loop cannot
  reach those students. The public `/review` link stays the path for them.
- **Typical failure mode:** Mario ignores this email too. It is bounded at three reminders per
  lesson, and it needs one tap, not a login with MFA. If it is still ignored, the next step is
  SMS to Mario, which is a different build (Twilio and A2P 10DLC registration).
- **Security trade-off:** whoever holds the email can record those lessons' outcomes without
  logging in. That bypasses admin MFA for one narrow action. It is bounded: one booking, one
  outcome, `pending` only, 14-day expiry, HMAC-SHA256 under a dedicated secret with a
  constant-time compare, and a rate limit. Worst case, a forwarded email lets someone mark a
  lesson as happened, which sends that real student one review request, or marks it as a
  no-show. Neither moves money or exposes contact details. The page shows only first name and
  last initial.
- **Best practice:** capture the outcome right after the event, in one action, from where the
  person already is. Email actions use a confirmation page plus POST, never GET.
- **Alternatives considered:**
  - Links into `/admin` behind login and MFA. That friction is why outcomes are not recorded
    today.
  - Auto-confirm every booking. Review requests would go to no-shows and to lessons Mario moved
    by text.
  - SMS to Mario. Cost plus carrier registration, for a channel not yet proven necessary.
  - A reminder with no actions. Another email to ignore.
- **Verdict:** build, with signed links, a confirmation page, and pending-only transitions.

## 5. Interface Code Contract

### 5.1 Morning digest email (to Mario)

- **To:** the first `ADMIN_EMAIL` address. **From:** `EMAIL_FROM`.
- **Subject:** `Did it happen? Foundations with Jane S.` for one lesson, or
  `3 lessons need an outcome` for several.
- **Per lesson:** student full name (Mario's own inbox, as on the new-booking alert), lesson
  name, date and time (CT), court preference if any, then three buttons: **Lesson happened**,
  **No-show**, **Didn't happen**.
- **Footer:** "Lesson happened lets the site ask [first name] for a review. Nothing is sent to
  the student for No-show or Didn't happen. Links expire in 14 days. You can also update
  lessons in Admin." Plus a link to `/admin`.
- All student text is HTML-escaped, including in `<title>` (see the wrap() fix in
  `fix/lead-alerts`).

### 5.2 Confirmation page `GET /lesson-outcome/[token]`

```html
<main class="outcome-page">
  <p class="kicker">Lesson outcome</p>
  <h1>Did Jane S.'s lesson happen?</h1>
  <dl class="outcome-facts">
    <div><dt>Lesson</dt><dd>Foundations</dd></div>
    <div><dt>When</dt><dd>Sun, Oct 18 · 9:00 AM CT</dd></div>
  </dl>
  <form method="post" action="/api/lesson-outcome">
    <input type="hidden" name="token" value="…" />
    <button type="submit" class="btn btn-primary btn-full">Yes, the lesson happened</button>
  </form>
  <p class="outcome-note">Jane gets a review request within a day. …</p>
  <a class="btn btn-ghost btn-full" href="/admin">Open Admin instead</a>
</main>
```

| State | Heading | Body |
|---|---|---|
| `pending` | "Did Jane S.'s lesson happen?" (or "Was Jane S. a no-show?" / "Did Jane S.'s lesson not happen?") | Facts, the one button for this link's outcome, and the note |
| `recorded` | "Recorded: lesson happened" (the booking's *current* status label) | What happens next. Also shown right after the POST and on any later visit |
| `expired` | "This link has expired" | Use Admin |
| `invalid` | "This link isn't valid" | Use Admin |
| `missing` | "That booking no longer exists" | Use Admin |
| `not_configured` | "Lesson outcome links aren't set up yet" | Use Admin |

- **Button labels:** "Yes, the lesson happened", "Mark as no-show", "Mark as didn't happen".
- **Classes:** `.outcome-page`, `.outcome-facts`, `.outcome-note`, reusing `.kicker`, `.btn`,
  `.btn-primary`, `.btn-ghost`, `.btn-full`. Existing colour tokens only.
- **Mobile:** a single column, max-width 480px, full-width buttons at least 44px tall.
- **Metadata:** `noindex, nofollow`. The token path is redacted from analytics as
  `/lesson-outcome/[token]`.
- **Banned:** state change on GET, the student's full name, email, or phone on the page,
  any email to the student, and an auto-redirect to login.

### 5.3 `POST /api/lesson-outcome`

1. Read `token` from the form body (urlencoded) or JSON.
2. Return 503 if `LESSON_OUTCOME_SECRET` is unset.
3. Rate limit: route `lesson_outcome`, 30 per hour per IP.
4. Verify the token. If it is invalid or expired, 303 back to the page, which renders the error
   state.
5. Conditional update: `status = <outcome> WHERE id = <booking> AND status = 'pending'`. Zero
   rows means it was already recorded, which is a no-op.
6. 303 to `/lesson-outcome/<token>`. The page reads the current status and shows `recorded`.

No email is sent from this route, and the overlap constraint cannot fire: every transition
leaves `pending` for a status that is either still active (`confirmed`) or inactive.

### 5.4 Token

`base64url("<bookingId>.<outcome>.<expiresAtUnixSeconds>") + "." + base64url(HMAC-SHA256(secret, "lesson-outcome:v1:" + payload))`

The payload is validated before the signature: a UUID, one of the three outcomes, and an
integer expiry. The compare uses `timingSafeEqual`. The domain prefix keeps the MAC from being
valid for any other purpose that might share the secret later.

## 6. Cron `GET /api/cron/lesson-outcomes`

- Schedule `0 13 * * *` (08:00 CDT / 07:00 CST), two hours before the review cron, so a tap
  over breakfast lets the 15:00 UTC review run ask the student the same day.
- Authorisation: `Authorization: Bearer <CRON_SECRET>`, as for the review cron. If
  `CRON_SECRET` or `LESSON_OUTCOME_SECRET` is unset, it logs and returns 500.
- Selects `status = 'pending'` with `lesson_date` between today-3 and today-1, Central time,
  ordered by date and time.
- Nothing pending means no email: `{ lessons: 0, sent: false }`. Otherwise it sends one digest
  and returns `{ lessons: N, sent: true }`.
- Response bodies never include student data.

## 7. Admin

A **Needs outcome** filter: `pending` with `lesson_date` before today. The filter and count
logic move into one function, so the count and the list cannot drift.

## 8. Testing

**Vitest:**
- Token round trip: tampered signature, tampered payload, swapped outcome, expired, wrong
  secret, and malformed.
- Central-time window across DST.
- Cron: 401 without the bearer; 500 without either secret; no email when nothing is pending;
  one digest for several lessons with the correct date filter.
- POST: records the outcome and returns 303; a replay is a no-op; invalid token; rate limit;
  503 when unconfigured.
- Digest template: escaping, plus three signed links per lesson.
- Page view-model: every state.
- Admin: the Needs outcome filter.

**Playwright:** not used for the page. It renders on the server from Supabase, which browser
route mocks cannot reach. The page's states come from a pure view-model function, unit
tested above.

## 9. Environment

- `LESSON_OUTCOME_SECRET`: generate with `openssl rand -base64 32`, set for Vercel Production
  only, then redeploy. Rotating it invalidates the links in unread digests, which cost at most
  one morning's taps.
- `CRON_SECRET`: already set (2026-07-26) and reused.
- `vercel.json`: one new cron. The team is on Pro, so the cron count is not a constraint.

## 10. Non-Goals

- Recording payment from the email. `paid_at` is a real gap (0 of 8 bookings marked paid), but
  one tap should mean one decision. It is a round-2 candidate: a "Paid?" follow-up once
  outcomes are flowing.
- Any student-facing change.
- Lessons booked off-site.

## 11. Open Inputs From DeMario

- Is 8:00 AM the right time, and are three reminders the right cap?
- Does "Didn't happen" fit how he handles a lesson moved by text? He would record the old date
  as Didn't happen and re-book the new one.
