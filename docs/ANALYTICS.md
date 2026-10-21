# Site Analytics

Cookieless Vercel Web Analytics: page views plus the custom events below. Defined in
`src/lib/analytics.ts`, which is the source of truth if this file and the code disagree.

## Where to read it

Vercel dashboard -> project `demario-pickleball` -> **Analytics** -> **Events**. Filter by event
name, then break down by a property (for example `booking_step_viewed` by `step`).

Web Analytics was enabled for the project on 2026-10-19 at 21:04 UTC. Before that, the Vercel
query API answered "Web Analytics not found" even though `/_vercel/insights/script.js` was
served. So a 200 from that script does not show Analytics is on: the Speed Insights script
answers 200 too, and the site does not use Speed Insights. Vercel adds the analytics routes
with the first deployment after enabling, and nothing below was recorded before it was on.

## Plan limits

The team is on Vercel Pro: custom events are included at $0.03 per 1,000 events, with at
most **2 properties per event** and a 12-month reporting window. Every event here stays
within two properties. Web Analytics Plus ($10/month) raises the limit to 8 properties.

## Privacy rules

- Every property is a fixed short code from a closed list in `src/lib/analytics.ts`. The
  types make it impossible to send a name, email, phone, free text, date, booking ID, or token.
- Links rendered by server components report clicks through `data-evt` attributes made by
  `eventAttributes()`. `SiteAnalytics` re-checks each one against the event list and a
  short-code pattern before sending.
- `booking_created` is sent from the server, which passes only the user agent and client IP.
  Without explicit headers the library forwards the request's cookies.
- In production that server event posts to `https://demariomontezpb.com/_vercel/insights/event`.
  The library's default target is the deployment's `*.vercel.app` address, which Vercel
  Authentication protects on this project; the post was redirected to a login page and the
  event silently lost. Set `VERCEL_WEB_ANALYTICS_ENDPOINT` to override.
- `/review/<token>` URLs are reported as `/review/[token]`.
- The privacy policy and cookie notice disclose the interaction counts.

## Events and the questions they answer

| Event | Properties | Question |
|---|---|---|
| `book_cta_click` | `source` (nav, hero, testimonials, lessons, final_cta, sticky), `lesson_type` (the card: beginner, advanced, clinic, drill, play_pro) | Which Book button starts bookings? |
| `booking_step_viewed` | `step` (details, terms, indoor_routing, picker, error, confirmed), `court_setup` | Where does the booking form lose people? Sent once per step per opening of the form, so Back, Try again, and a taken slot do not count a step twice. |
| `booking_failed` | `reason` (slot_taken, rate_limited, invalid, server, network) | Are bookings failing, and why? |
| `booking_created` | `lesson_type` (as stored: beginner, advanced, clinic, drill_60, drill_90, play_pro), `court_setup` | How many bookings were actually saved (server-side)? Group size is not sent; the event's two properties are taken, and the database has it. |
| `venue_link_click` | `venue` (dallas_indoor, the_grove, teachme_to, ...), `surface` | How many students leave for PodPlay or TeachMe.To? |
| `contact_click` | `channel` (sms, tel, email), `surface` | How many text, call, or email Mario directly? |
| `payment_link_click` | `method` (cashapp, zelle, paypal, paypal_qr), `surface` | Which payment methods do students open? |
| `inquiry_submit` | `result` | Does the contact form work for real visitors? |
| `review_submit` | `result`, `path` (public, token) | Does the review form work, and where do people stop? |
| `outbound_click` | `dest` (instagram, tiktok, facebook, google_review, teachme_reviews) | Do visitors check the social and review profiles? |

The funnel to watch is `book_cta_click` -> `booking_step_viewed` (details -> picker or
indoor_routing -> confirmed) -> `booking_created`. Link clicks count left and middle clicks;
a link opened from the right-click menu is not counted. Indoor students finish on a partner
platform, so for them `venue_link_click` is the conversion.

Adding an event: add it to `AnalyticsEvents` with closed-set property types, keep it to two
properties, list it here, and update the privacy policy if it measures a new kind of thing.
