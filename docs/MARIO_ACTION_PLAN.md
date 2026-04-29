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
7. If a new venue comes up, use `docs/VENUE_RULES.md` before asking Tonio to add
   it to the site.

Done when: every student is routed through the correct public-court, venue, or
platform path.

### Keep Insurance And Waiver Proof On File

Why: legal/insurance work is sorted for launch, but Mario should keep the proof
easy to find.

Mario does:

1. Save the active coaching liability insurance certificate.
2. Keep the reviewed waiver, terms, payment, and cancellation wording as the
   launch baseline.
3. Do not improvise legal, payment, cancellation, or waiver wording in student
   texts.
4. Send Tonio any future required wording changes before the site changes.

Done when: Mario knows where the current proof and reviewed wording live.

## Tonio Tasks After Mario Finishes

- Add the fresh Google refresh token to Vercel and redeploy.
- Confirm Admin -> Availability says Google Calendar is connected.
- Add DUPR server-side sync only after DUPR grants read-only access.
- Update site copy if venue, pricing, packages, waiver language, or business
  name changes.
