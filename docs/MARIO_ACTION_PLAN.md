# Mario Action Plan

Use this as Mario's plain-language checklist. Anything in this file should be
safe for Mario to understand without knowing Vercel, Supabase, GitHub, or code.

## How To Use The Admin

1. Go to `https://demariomontezpb.com/admin`.
2. Open **Tasks** for the short list of things to do now.
3. Open **Business** for the longer roadmap.
4. Check off a task only when the "done" condition in the notes is true.
5. Send Tonio screenshots, approval emails, or exact wording when a task says to
   hand something back.

## Do Not Touch

Mario should not change these unless Tonio is on the call:

- Vercel environment variables
- Supabase database settings or SQL
- Google Cloud project settings
- OAuth client secrets, refresh tokens, or API keys
- GitHub or source code

## Current Mario Tasks

### Connect Google Calendar For Booking Protection

Why: the site can hide lesson times when Mario already has another appointment.

Mario does:

1. Sign into `demariomontez10@gmail.com`.
2. When Tonio sends the Google permission flow, approve Calendar free/busy access.
3. Do not approve broader calendar permissions unless Tonio explains why.
4. After Tonio redeploys, open Admin -> Availability.
5. Confirm the Google Calendar sync row says connected.
6. Add one test busy event in Google Calendar over a normally bookable lesson
   time.
7. Confirm Tonio sees that time blocked in the public booking picker.

Done when: Tonio confirms the admin diagnostic is connected and the test busy
event blocks a public lesson slot.

### Ask DUPR For Read-Only Access

Why: the site currently shows Mario's DUPR ratings manually. Automated ratings
should wait for official DUPR access.

Mario does:

1. Log into DUPR with his coach/player account.
2. Contact DUPR support, API support, or partner support.
3. Send this request:

```text
I am DeMario Montez, a pickleball coach. I want my coaching site,
https://demariomontezpb.com, to display my verified DUPR singles and doubles
ratings. Do you offer an external read-only API token or partner integration for
this use case? The site only needs to read my verified ratings. It does not need
to submit matches, edit profile data, or access private player data.
```

4. Send Tonio the approval email, token instructions, or partner contact.
5. Do not post API tokens in group chats or public docs.

Done when: DUPR replies with a token path, partner path, or a clear "not
available" answer.

### Choose Bookable Lesson Times

Why: students can only book the time slots shown in Admin -> Availability.

Mario does:

1. Write the normal lesson times he is willing to teach.
2. Include only times he can realistically honor.
3. Add them in Admin -> Availability -> Time slots, or send the exact list to
   Tonio.
4. Block one-off days when tournaments, travel, or personal plans come up.

Done when: the public booking picker only shows times Mario is willing to teach.

### Confirm Each New Student's Court Plan

Why: the site reserves the lesson time first, then Mario confirms the exact
court after checking the student's preference, weather, court fees, and court
availability.

Mario does:

1. Open the new booking in Admin.
2. Read the student's phone number, preferred court setup, and preferred
   area/court note.
3. Text the student the exact court, any court reservation fee, and payment
   reminder.
4. If the student chose "Help me choose," recommend the easiest court plan for
   their location, weather, and lesson type.
5. Mark the lesson paid only after Cash App, Zelle, or PayPal is received.

Done when: every new booking has a clear text confirmation with exact court,
court fee expectations, and payment status.

### Save The Insurance Certificate

Why: the website can show the policy and booking flow, but it is not the
official insurance record.

Mario does:

1. Save the active coaching liability insurance certificate in a known folder.
2. Make sure Tonio and Mario both know where the current certificate lives.
3. Replace the saved certificate whenever coverage renews or changes.

Done when: the current insurance certificate is easy to find without searching
texts, emails, or the website.

### Save The Reviewed Launch Policy Baseline

Why: the site Terms, waiver, payment rules, and cancellation rules should stay
consistent with the reviewed launch wording.

Mario does:

1. Keep proof that the website Terms, waiver, payment, and cancellation wording
   are the reviewed launch baseline.
2. Do not improvise legal, payment, cancellation, or waiver wording in student
   texts.
3. Send Tonio any future required wording changes before using them with
   students.

Done when: Mario knows which wording is approved for launch and where the proof
lives.

### Follow The Launch Payment Rules

Why: direct site bookings use manual payment for launch, so Mario has to keep
payment matching clean.

Mario does:

1. Have students pay through Cash App, Zelle, or PayPal.
2. Ask students to include the booking ID in the payment memo.
3. Confirm any court reservation fee separately before the lesson.
4. Mark the lesson paid in Admin only after Cash App, Zelle, or PayPal is
   received.

Done when: every paid lesson has a matching payment memo or clear payment
record.

### Follow The Launch Cancellation Rules

Why: students need the same cancellation expectation every time.

Mario does:

1. 24+ hours notice means free cancellation or reschedule.
2. Under 24 hours may be charged 50% of the lesson price.
3. No-shows may be charged the full lesson price.
4. If Mario cancels, offer a refund or free reschedule.
5. Use Admin Cancel so the student receives the cancellation email.

Done when: every cancellation follows the same policy and the admin status
matches what happened.

### Follow The Venue Routing Matrix

Why: students should always use the correct court reservation path without
guessing or bypassing a venue platform.

Mario does:

1. Use this site for public outdoor court lesson times.
2. Send Dallas Indoor Pickleball Club students through PodPlay.
3. Send The Grove Pickleball students through PodPlay.
4. Send Life Time students through Life Time's member booking system.
5. Send TeachMe.To students through TeachMe.To.
6. For Samuel-Grand, have the student reserve the court through Impact
   Activities, then coordinate the coaching fee separately.
7. Save any venue or platform permission emails, owner texts, policy pages, or
   agreements.
8. If a new venue comes up, use `docs/VENUE_RULES.md` before asking Tonio to add
   it to the site.

Done when: every student is routed through the correct public-court, venue, or
platform path, and the proof is easy to find.

## Later Growth Ideas Already Captured

These are not launch tasks. They belong in Admin -> Business after the booking
flow is stable and coaching revenue is consistent.

### Review Solopreneur Back-Office Support

Why: once coaching income reaches the right threshold, a CPA or solopreneur
service may save more in taxes and admin time than it costs.

Mario does:

1. Track monthly coaching revenue and profit first.
2. Ask a CPA when it makes sense to consider an S-corp election.
3. Compare CPA support with a service like Collective for taxes, payroll,
   bookkeeping, and back-office help.
4. Do not convert the business structure just because it sounds advanced; do it
   when the savings and admin support clearly justify the cost.

Done when: Mario has a CPA-backed recommendation on whether to stay simple,
form/use an LLC, elect S-corp taxation, or use a solopreneur support service.

### Pilot An AI-Native Ops Assistant

Why: before hiring a human assistant, a lightweight assistant could help Mario
stay on top of reminders, admin chores, student follow-ups, and business
maintenance.

Mario does:

1. Keep using Admin -> Bookings, Tasks, and Business until the weekly routine is
   stable.
2. List the repetitive chores that slow him down: unpaid lessons, follow-up
   texts, student notes, court-routing checks, monthly P&L, tax reminders, and
   admin cleanup.
3. Have Tonio prototype a simple assistant only after those chores are clear.
4. Start with reminders and checklists before trusting it with customer-facing
   communication.

Done when: the assistant reliably flags boring back-office to-dos without making
the business feel more complicated.

## Tonio Tasks After Mario Finishes

- Add the fresh Google refresh token to Vercel and redeploy.
- Confirm Admin -> Availability says Google Calendar is connected.
- Add DUPR server-side sync only after DUPR grants read-only access.
- Update site copy if venue, pricing, packages, waiver language, or business
  name changes.
