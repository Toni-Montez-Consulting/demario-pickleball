# Automatic Reviews

**Status:** built 2026-10-22. Decided by Tonio the same day: "Go live immediately but Mario should
have the ability to take down a nefarious or untrue review."

## 1. The problem

Reviews reached the site only after DeMario clicked Publish in `/admin`, which he does not open, and
nothing told him a review had arrived. A student's review could sit unseen forever. The goal is more
students, and reviews that keep appearing without DeMario doing anything are part of the proof that
gets them.

## 2. Product questions

1. **Who uses each surface?**
   - A student who just had a lesson, on the link emailed 24 hours later. That link is tied to a
     real booking.
   - Anyone on the public `/review` page, which DeMario texts to past students. It is tied to nothing.
   - DeMario, on his phone, reading the email about a new review.
   - A site visitor reading reviews on the homepage.
2. **The one decision each owns.**
   - The student: leave a review and agree to its publication. The form already requires that
     agreement.
   - DeMario, for a live review: keep it up or take it down. For a waiting public one: publish it
     or leave it.
3. **What they already know.** The student's review request says "Nothing gets posted without your
   ok." DeMario knows the outcome-link pattern from his morning email: a button opens a page, and a
   second button there acts.
4. **What they cannot do.** DeMario cannot edit a student's words, only take a review down or put it
   back. A publish link cannot undo a takedown. A public review cannot go live without DeMario.
5. **What we protect.** Students: only the display name they chose shows. DeMario: a fake, abusive, or
   untrue review can come down in two taps. Visitors: honest low ratings stay up. Filtering by stars
   is not allowed: the federal review rule, 16 CFR 465.7(b), bars implying the reviews shown are most
   or all of them while low ratings are held back. Withholding for reasons applied to every review,
   such as abuse, someone else's personal information, off-topic content, or a fake, is allowed.
6. **What must be true before a review goes live.** Verified link: the student agreed to publication
   (required by the form and a database CHECK) and wrote words. Stars alone cannot show on the site.
   Public page: DeMario tapped Publish.
7. **Success.** A verified student's review appears on the homepage minutes after they submit it,
   with nobody touching anything. DeMario gets one email per review and can act on it from his phone.
   Nothing the student did not agree to publish ever appears.

## 3. Design

- `POST /api/reviews`, verified path: a review with words is saved as `published` at once, at any
  rating. Stars only stay unpublished; they cannot show on the site.
- `POST /api/reviews`, public path: saved as `pending`.
- Every submission emails DeMario (`reviewNotificationHtml`): the stars, the display name, the words,
  where it came from, and one button.
  - Live review: **Take it down**.
  - Waiting public review: **Publish it**.
  - Stars only: no button.
- Each button is a signed link (`src/lib/review-moderation.ts`) lasting 60 days. It opens
  `/review-action/[token]`, which changes nothing; mail scanners open every link in an email. Only
  that page's button posts to `/api/review-action`.
  - Take it down: moves the review out of `published` or `pending` into `hidden`.
  - Publish it: moves only `pending` to `published`, so it cannot undo a takedown.
- The takedown page says what it is for: "Take a review down only if it is abusive, fake, or says
  something untrue. A low rating is not a reason."
- The links share the lesson-outcome secret (`LESSON_OUTCOME_SECRET`), separated by a domain prefix,
  so an outcome link can never pass as a review link. No new environment variable is needed.
- Admin still does everything: publish, hide, delete, and the featured labels.

## 4. Limitations check

- **Known ceiling:** reviews come only from students who are asked. Today that is students who booked
  on the site, about one a month. Automatic publishing makes no new reviews.
- **Typical failure mode:** a harsh or false review sits live until DeMario reads his email.
- **Best practice:** publish with a fast, principled takedown, and record why. The reason is shown,
  not stored; storing it needs a database column.
- **Alternatives:** approve-before-publish by one tap. Safer, but it depends on DeMario acting, and he
  has not acted in Admin.
- **Verdict:** use it, and pair it with getting direct students booking through the site, which is
  what feeds the review requests.

## 5. Build integrity

- **Disconfirmation:** no student has ever submitted a review through the site (the first request
  went out 2026-10-20). The test is whether verified reviews grow over the next 60 days.
- **Integrity:** it works with the mechanism fully visible. The student agrees to publication, every
  rating goes up, and the takedown page states its rule.
- **Ego:** the real bottleneck is supply, not publishing.
- **Agency:** proposed before Tonio chose it. The one disagreement on record is that automation cannot
  create reviews; only asking more real students can.

## 6. Not in scope

- Asking for reviews from students who did not book on the site. That needs its own design. The
  simplest path is DeMario's direct students booking on the site.
- TeachMe.To reviews. Its terms forbid copying its content and asking its students for reviews
  elsewhere.
- Star ratings in Google results. Google does not show them for reviews a business collects about
  itself.
- Storing a takedown reason.
