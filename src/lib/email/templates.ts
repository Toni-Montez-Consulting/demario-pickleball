import { SITE_URL } from "@/lib/site";
import { COURT_CONFIRMATION_MESSAGE, LESSON_LOCATION } from "@/lib/business";
import { parseBookingNotes } from "@/lib/booking-notes";
import { fixedFee, lessonName, storedQuote } from "@/lib/lesson-types";
import { formatLessonDate } from "@/lib/time";
import { playersLabel, usd } from "@/lib/session-pricing";
import { generateGoogleCalendarUrl, type IcsBooking } from "./ics";
import { arrivalSourceLabel, type ArrivalSource } from "@/lib/arrival-source";

/**
 * A group booking's players and the total the person booking pays, from the
 * quote stored with the booking. Null for every other lesson.
 */
function groupRows(booking: IcsBooking): { players: string; total: string } | null {
  const quote = storedQuote(booking);
  if (!quote) return null;
  return {
    players: `${playersLabel(quote.groupSize)} · ${usd(quote.perPerson)} per person`,
    total: `${usd(quote.total)} total`,
  };
}

// Callers pass raw strings, often with a student's name in the heading, so
// the title is escaped here. Unescaped, a name like "</title><a href=...>"
// broke out of <title> and injected markup into Mario's notification.
function wrap(inner: string, heading: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;">
    <tr><td>
      ${inner}
    </td></tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;color:#888;font-size:12px;text-align:center;">
    DeMario Montez Pickleball Coaching · Dallas, TX<br>
    <a href="${SITE_URL}" style="color:#888;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
  </p>
</body>
</html>`;
}

export function studentRequestedHtml(booking: IcsBooking): string {
  const lesson = lessonName(booking.lesson_type);
  const group = groupRows(booking);
  const fee = fixedFee(booking.lesson_type);
  const price = group ? group.total : fee !== null ? usd(fee) : "";
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const court = parseBookingNotes(booking.notes);
  return wrap(
    `
    <h1 style="font-size:22px;margin:0 0 12px;">You're booked, ${escapeHtml(greetingName(booking.name))}.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#444;">
      Your lesson time is reserved. Mario will confirm the exact court shortly.
    </p>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#777;">Lesson</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(lesson)}</strong></td></tr>
      ${group ? `<tr><td style="padding:6px 0;color:#777;">Players</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(group.players)}</strong></td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#777;">Date</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(formatLessonDate(booking.lesson_date))}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Time</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(booking.lesson_time)} CT</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Court</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(LESSON_LOCATION)}</strong></td></tr>
      ${court.courtSetup ? `<tr><td style="padding:6px 0;color:#777;">Preference</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(court.courtSetup)}</strong></td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#777;">Booking ID</td><td style="padding:6px 0;text-align:right;font-family:monospace;"><strong>${shortId}</strong></td></tr>
      ${price ? `<tr><td style="padding:6px 0;color:#777;">Lesson fee</td><td style="padding:6px 0;text-align:right;"><strong>${price}</strong></td></tr>` : ""}
    </table>
    <p style="font-size:14px;margin:0 0 12px;">
      <strong>Pay before your lesson:</strong>
    </p>
    <p style="margin:0 0 12px;">
      <a href="${SITE_URL}/pay" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Pay DeMario</a>
    </p>
    <p style="margin:0 0 20px;">
      <a href="${generateGoogleCalendarUrl({ booking })}" style="display:inline-block;padding:10px 16px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Add to Google Calendar</a>
    </p>
    <p style="font-size:13px;color:#666;line-height:1.5;margin:0;">
      Include booking ID <strong>${shortId}</strong> in the memo so Mario can match your payment. ${escapeHtml(COURT_CONFIRMATION_MESSAGE)}
      Court reservation fees, if any, are confirmed separately by Mario before the lesson.
    </p>
    `,
    `Booking confirmed — ${formatLessonDate(booking.lesson_date)}`
  );
}

/** A new booking as Mario's alert sees it: the booking plus where the student came from. */
export interface NewBookingAlert extends IcsBooking {
  arrival_source?: ArrivalSource | null;
}

export function adminNotificationHtml(booking: NewBookingAlert): string {
  const lesson = lessonName(booking.lesson_type);
  const group = groupRows(booking);
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const court = parseBookingNotes(booking.notes);
  return wrap(
    `
    <h1 style="font-size:20px;margin:0 0 12px;">New booking — ${escapeHtml(lesson)}</h1>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#777;">Student</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(booking.name)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Email</td><td style="padding:6px 0;text-align:right;"><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a></td></tr>
      ${booking.phone ? `<tr><td style="padding:6px 0;color:#777;">Phone</td><td style="padding:6px 0;text-align:right;"><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone)}</a></td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#777;">Lesson</td><td style="padding:6px 0;text-align:right;">${escapeHtml(lesson)}</td></tr>
      ${group ? `<tr><td style="padding:6px 0;color:#777;">Players</td><td style="padding:6px 0;text-align:right;">${escapeHtml(group.players)}</td></tr>
      <tr><td style="padding:6px 0;color:#777;">Booker pays</td><td style="padding:6px 0;text-align:right;">${escapeHtml(group.total)}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#777;">Date</td><td style="padding:6px 0;text-align:right;">${escapeHtml(formatLessonDate(booking.lesson_date))} · ${escapeHtml(booking.lesson_time)} CT</td></tr>
      ${court.courtSetup ? `<tr><td style="padding:6px 0;color:#777;">Court setup</td><td style="padding:6px 0;text-align:right;">${escapeHtml(court.courtSetup)}</td></tr>` : ""}
      ${court.preferredArea ? `<tr><td style="padding:6px 0;color:#777;">Area/court note</td><td style="padding:6px 0;text-align:right;">${escapeHtml(court.preferredArea)}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#777;">Found you through</td><td style="padding:6px 0;text-align:right;">${escapeHtml(arrivalSourceLabel(booking.arrival_source))}</td></tr>
      <tr><td style="padding:6px 0;color:#777;">Booking ID</td><td style="padding:6px 0;text-align:right;font-family:monospace;">${shortId}</td></tr>
    </table>
    <p style="font-size:13px;color:#666;line-height:1.5;margin:16px 0 0;">
      Text the student to confirm the exact court, any court fee, and payment before the lesson.
    </p>
    <p style="margin:20px 0 0;">
      <a href="${SITE_URL}/admin" style="color:#0070ba;text-decoration:underline;font-weight:600;">Open admin dashboard</a>
    </p>
    `,
    `New booking — ${booking.name}`
  );
}

export function inquiryNotificationHtml({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}): string {
  const first = firstName(name, "them");
  return wrap(
    `
    <h1 style="font-size:20px;margin:0 0 12px;">New message from the site</h1>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
      <tr><td style="padding:6px 0;color:#777;">From</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(name)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Email</td><td style="padding:6px 0;text-align:right;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
    </table>
    <div style="background:#f5f5f5;border-radius:8px;padding:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
    <p style="font-size:13px;color:#666;line-height:1.5;margin:16px 0 0;">
      Reply to this email to answer ${escapeHtml(first)} directly. The contact form promises a reply within 24 hours.
    </p>
    <p style="margin:20px 0 0;">
      <a href="${SITE_URL}/admin" style="color:#0070ba;text-decoration:underline;font-weight:600;">Open admin dashboard</a>
    </p>
    `,
    `New message — ${name}`
  );
}

/**
 * Sent once when contact-form alerts pause for the day, so a burst of spam
 * cannot silently hide a real student's message in /admin.
 */
export function inquiryAlertsPausedHtml(limit: number): string {
  return wrap(
    `
    <h1 style="font-size:20px;margin:0 0 12px;">Contact alerts are paused for today</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px;color:#444;">
      More than ${limit} contact messages arrived in the last 24 hours. That is usually spam, so
      the site stopped emailing each one to save the booking emails' sending quota.
    </p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 12px;color:#444;">
      Every message is still saved. A real student may be among them, so look through them in
      Admin. Alerts start again on their own once the count drops.
    </p>
    <p style="margin:20px 0 0;">
      <a href="${SITE_URL}/admin" style="color:#0070ba;text-decoration:underline;font-weight:600;">Open admin dashboard</a>
    </p>
    `,
    "Contact alerts paused"
  );
}

export interface OutcomeDigestLesson {
  name: string;
  lessonName: string;
  /** "3 players", for a group format. */
  players?: string | null;
  when: string;
  courtSetup: string | null;
  links: { confirmed: string; no_show: string; cancelled: string };
}

/**
 * Mario's morning digest of lessons that still need an outcome. Each button
 * opens a confirmation page; nothing is recorded until he taps the button
 * there (mail scanners fetch every link in an email).
 */
export function lessonOutcomeDigestHtml(lessons: OutcomeDigestLesson[]): string {
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 6px 6px 0;padding:9px 14px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;${
      primary ? "background:#111;color:#fff;" : "background:#f0f0f0;color:#222;"
    }">${label}</a>`;
  const rows = lessons
    .map(
      (lesson) => `
    <div style="border-top:1px solid #eee;padding:16px 0;">
      <p style="margin:0 0 4px;font-size:15px;"><strong>${escapeHtml(lesson.name)}</strong> · ${escapeHtml(lesson.lessonName)}${
        lesson.players ? ` · ${escapeHtml(lesson.players)}` : ""
      }</p>
      <p style="margin:0 0 12px;font-size:14px;color:#666;">${escapeHtml(lesson.when)}${
        lesson.courtSetup ? ` · ${escapeHtml(lesson.courtSetup)}` : ""
      }</p>
      ${button(lesson.links.confirmed, "Lesson happened", true)}${button(lesson.links.no_show, "No-show", false)}${button(lesson.links.cancelled, "Didn't happen", false)}
    </div>`
    )
    .join("");
  const heading =
    lessons.length === 1 ? "Did this lesson happen?" : `${lessons.length} lessons need an outcome`;
  return wrap(
    `
    <h1 style="font-size:20px;margin:0 0 8px;">${heading}</h1>
    <p style="font-size:14px;line-height:1.5;margin:0 0 8px;color:#444;">
      One tap each. "Lesson happened" is what lets the site ask the student for a review.
    </p>
    ${rows}
    <p style="font-size:13px;color:#666;line-height:1.5;margin:16px 0 0;">
      Nothing is sent to the student for No-show or Didn't happen. Each button opens a page where
      you confirm; links expire in 14 days. Lessons drop off this email after three mornings.
    </p>
    <p style="margin:16px 0 0;">
      <a href="${SITE_URL}/admin" style="color:#0070ba;text-decoration:underline;font-weight:600;">Open admin dashboard</a>
    </p>
    `,
    heading
  );
}

export function studentCancelledHtml(booking: IcsBooking): string {
  const lesson = lessonName(booking.lesson_type);
  return wrap(
    `
    <h1 style="font-size:22px;margin:0 0 12px;">Your lesson was cancelled.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#444;">
      The attached calendar file will remove this lesson from your calendar.
    </p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#555;">
      <strong>${escapeHtml(lesson)}</strong> — ${escapeHtml(formatLessonDate(booking.lesson_date))} at ${escapeHtml(booking.lesson_time)} CT
    </p>
    <p style="font-size:14px;color:#666;margin:0;">
      Questions? Reply to this email or text <a href="tel:4693719220">(469) 371-9220</a>.
    </p>
    `,
    `Lesson cancelled — ${formatLessonDate(booking.lesson_date)}`
  );
}

/**
 * The first name for the booking confirmation's greeting, or "there".
 *
 * The confirmation goes to whatever address the booker typed, before anyone
 * has proved they own it. Echoing free text there would let a stranger send a
 * link like "evil.example/pay" from bookings@demariomontezpb.com, so only a
 * plain name is used: letters, apostrophes, and hyphens.
 */
export function greetingName(name: string): string {
  const first = firstName(name, "");
  return PLAIN_NAME.test(first) ? first : "there";
}

// Built at runtime: a \p{L} literal needs an ES2018 target, and tsconfig targets ES2017.
const PLAIN_NAME = new RegExp("^[\\p{L}'\u2019-]{1,30}$", "u");

/** The first word of a name, or the fallback when there is none. */
export function firstName(name: string, fallback: string): string {
  return name.trim().split(/\s+/)[0] || fallback;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function feedbackNotificationHtml({
  type,
  title,
  description,
  submitter,
}: {
  type: string;
  title: string;
  description: string;
  submitter: string;
}): string {
  return wrap(
    `
    <h1 style="font-size:20px;margin:0 0 8px;">Admin feedback: ${escapeHtml(type)}</h1>
    <p style="font-size:13px;color:#888;margin:0 0 20px;">Submitted by ${escapeHtml(submitter)} via the admin portal</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#777;vertical-align:top;">Type</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(type)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;vertical-align:top;">Title</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(title)}</strong></td></tr>
    </table>
    <p style="font-size:13px;color:#777;margin:0 0 6px;">Description</p>
    <div style="background:#f5f5f5;border-radius:8px;padding:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(description)}</div>
    <p style="font-size:13px;color:#888;margin:20px 0 0;">This was automatically added to the Tasks list in the admin portal.</p>
    `,
    `Admin Feedback: ${type}`
  );
}

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
  const first = firstName(name, "there");
  return wrap(
    `
    <h1 style="font-size:22px;margin:0 0 12px;">How was it, ${escapeHtml(first)}?</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#444;">
      Thanks for training with me on ${escapeHtml(lessonDate)}. I hope the ${escapeHtml(lessonName)}
      gave you something specific to work on.
    </p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#444;">
      If you have a minute, I would appreciate a quick review. It takes about thirty seconds
      and it helps other players find me.
    </p>
    <p style="margin:0 0 20px;">
      <a href="${reviewUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Leave a review</a>
    </p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 20px;color:#444;">
      Ready for the next one? <a href="${SITE_URL}/book-again" style="color:#0070ba;text-decoration:underline;font-weight:600;">Book your next lesson</a>
    </p>
    <p style="font-size:13px;color:#666;line-height:1.5;margin:0;">
      Nothing gets posted without your ok, and you choose how your name appears.
      See you on the court.<br>DeMario
    </p>
    `,
    "How was your lesson?"
  );
}
