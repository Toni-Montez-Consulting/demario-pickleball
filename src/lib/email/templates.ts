import { SITE_URL } from "@/lib/site";
import { COURT_CONFIRMATION_MESSAGE, LESSON_LOCATION } from "@/lib/business";
import { parseBookingNotes } from "@/lib/booking-notes";
import { generateGoogleCalendarUrl, type IcsBooking } from "./ics";

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

const LESSON_PRICES: Record<string, string> = {
  beginner: "$70",
  advanced: "$80",
  clinic: "$50",
};

function wrap(inner: string, heading: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${heading}</title></head>
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
  const lesson = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;
  const price = LESSON_PRICES[booking.lesson_type] ?? "";
  const shortId = booking.id.slice(0, 8).toUpperCase();
  const court = parseBookingNotes(booking.notes);
  return wrap(
    `
    <h1 style="font-size:22px;margin:0 0 12px;">You're booked, ${escapeHtml(booking.name.split(" ")[0])}.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#444;">
      Your lesson time is reserved. Mario will confirm the exact court shortly.
    </p>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#777;">Lesson</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(lesson)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Date</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(booking.lesson_date)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Time</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(booking.lesson_time)} CT</strong></td></tr>
      <tr><td style="padding:6px 0;color:#777;">Court</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(LESSON_LOCATION)}</strong></td></tr>
      ${court.courtSetup ? `<tr><td style="padding:6px 0;color:#777;">Preference</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(court.courtSetup)}</strong></td></tr>` : ""}
      ${court.preferredArea ? `<tr><td style="padding:6px 0;color:#777;">Area/court note</td><td style="padding:6px 0;text-align:right;"><strong>${escapeHtml(court.preferredArea)}</strong></td></tr>` : ""}
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
    `Booking confirmed — ${booking.lesson_date}`
  );
}

export function adminNotificationHtml(booking: IcsBooking): string {
  const lesson = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;
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
      <tr><td style="padding:6px 0;color:#777;">Date</td><td style="padding:6px 0;text-align:right;">${escapeHtml(booking.lesson_date)} · ${escapeHtml(booking.lesson_time)} CT</td></tr>
      ${court.courtSetup ? `<tr><td style="padding:6px 0;color:#777;">Court setup</td><td style="padding:6px 0;text-align:right;">${escapeHtml(court.courtSetup)}</td></tr>` : ""}
      ${court.preferredArea ? `<tr><td style="padding:6px 0;color:#777;">Area/court note</td><td style="padding:6px 0;text-align:right;">${escapeHtml(court.preferredArea)}</td></tr>` : ""}
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

export function studentCancelledHtml(booking: IcsBooking): string {
  const lesson = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;
  return wrap(
    `
    <h1 style="font-size:22px;margin:0 0 12px;">Your lesson was cancelled.</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 16px;color:#444;">
      The attached calendar file will remove this lesson from your calendar.
    </p>
    <p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#555;">
      <strong>${escapeHtml(lesson)}</strong> — ${escapeHtml(booking.lesson_date)} at ${escapeHtml(booking.lesson_time)} CT
    </p>
    <p style="font-size:14px;color:#666;margin:0;">
      Questions? Reply to this email or text <a href="tel:4693719220">(469) 371-9220</a>.
    </p>
    `,
    `Lesson cancelled — ${booking.lesson_date}`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
