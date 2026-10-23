import * as Sentry from "@sentry/nextjs";
import { Resend, type CreateEmailOptions } from "resend";
import { shortName } from "@/lib/lesson-outcomes";
import { lessonName } from "@/lib/lesson-types";
import { formatLessonDate } from "@/lib/time";
import { generateIcs, type IcsBooking, type IcsMethod } from "./ics";
import {
  studentRequestedHtml,
  adminNotificationHtml,
  studentCancelledHtml,
  feedbackNotificationHtml,
  reviewRequestHtml,
  inquiryNotificationHtml,
  inquiryAlertsPausedHtml,
  lessonOutcomeDigestHtml,
  lessonReminderHtml,
  firstName,
  type OutcomeDigestLesson,
} from "./templates";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "DeMario Pickleball <bookings@demariomontezpb.com>";
}

function adminEmail(): string {
  const val = process.env.ADMIN_EMAIL ?? "demariomontez10@gmail.com";
  return val.split(",")[0].trim();
}

/** Names come from public forms. One line, so they cannot add lines to a subject header. */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

/**
 * The Resend SDK returns failures instead of throwing, so a revoked key, an
 * unverified domain, or a spent quota would drop every email with only a
 * console line. Report each failure to Sentry as well.
 */
function reportSendFailure(label: string, error: { name: string; message: string }): void {
  console.error(`[email] ${label} failed`, error);
  Sentry.captureException(new Error(`[email] ${label} failed: ${error.name}: ${error.message}`), {
    tags: { email: label, resend_error: error.name },
  });
}

/**
 * Sends one of Mario's alerts with Reply-To set to the student. Resend rejects
 * the whole send when it considers that address invalid (a local part over 64
 * characters passes the forms' checks), so on a validation error the alert goes
 * again without Reply-To. The student's address is in the body either way.
 */
async function sendAlertToMario(resend: Resend, label: string, email: CreateEmailOptions): Promise<void> {
  let result = await resend.emails.send(email);
  if (result.error?.name === "validation_error" && email.replyTo) {
    result = await resend.emails.send({ ...email, replyTo: undefined });
  }
  if (result.error) reportSendFailure(label, result.error);
}

export async function sendBookingCreatedEmails(booking: IcsBooking): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping booking email");
    return;
  }

  const { ics, filename } = generateIcs({
    booking,
    method: "REQUEST",
    organizerEmail: adminEmail(),
  });
  const icsContent = Buffer.from(ics).toString("base64");
  const lesson = lessonName(booking.lesson_type);

  const studentResult = await resend.emails.send({
    from: emailFrom(),
    to: booking.email,
    subject: `You're booked — ${lesson} on ${formatLessonDate(booking.lesson_date)}`,
    html: studentRequestedHtml(booking),
    attachments: [{ filename, content: icsContent, contentType: "text/calendar; method=REQUEST" }],
    // Without this a student replying to their confirmation hits the no-reply
    // sending domain and bounces. Mario never sees the question.
    replyTo: adminEmail(),
  });
  if (studentResult.error) reportSendFailure("student confirmation", studentResult.error);

  await sendAlertToMario(resend, "booking alert", {
    from: emailFrom(),
    to: adminEmail(),
    subject: `New booking — ${oneLine(booking.name)} · ${formatLessonDate(booking.lesson_date)} ${booking.lesson_time}`,
    html: adminNotificationHtml(booking),
    replyTo: booking.email,
  });
}

/**
 * Tells Mario a contact-form message arrived. Before this, inquiries only
 * appeared in /admin, which Mario rarely opens, while the form promised a
 * reply within 24 hours. Reply-To is the student, so answering is one tap.
 */
export async function sendInquiryNotificationEmail(inquiry: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping inquiry notification");
    return;
  }
  await sendAlertToMario(resend, "inquiry alert", {
    from: emailFrom(),
    to: adminEmail(),
    subject: `New message — ${oneLine(inquiry.name)}`,
    html: inquiryNotificationHtml(inquiry),
    replyTo: inquiry.email,
  });
}

/** Tells Mario, once, that contact-form alerts paused for the day. */
export async function sendInquiryAlertsPausedEmail(limit: number): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping inquiry pause notice");
    return;
  }
  const result = await resend.emails.send({
    from: emailFrom(),
    to: adminEmail(),
    subject: `Contact alerts paused: more than ${limit} messages today`,
    html: inquiryAlertsPausedHtml(limit),
  });
  if (result.error) reportSendFailure("inquiry pause notice", result.error);
}

export async function sendBookingCancelledEmail(booking: IcsBooking): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping cancellation email");
    return;
  }

  const { ics, filename } = generateIcs({
    booking,
    method: "CANCEL",
    organizerEmail: adminEmail(),
  });
  const icsContent = Buffer.from(ics).toString("base64");

  const result = await resend.emails.send({
    from: emailFrom(),
    to: booking.email,
    subject: `Cancelled: your lesson on ${formatLessonDate(booking.lesson_date)}`,
    html: studentCancelledHtml(booking),
    attachments: [{ filename, content: icsContent, contentType: "text/calendar; method=CANCEL" }],
    replyTo: adminEmail(),
  });
  if (result.error) reportSendFailure("cancellation", result.error);
}

export async function sendFeedbackEmail({
  type,
  title,
  description,
  submitter,
}: {
  type: string;
  title: string;
  description: string;
  submitter: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping feedback email");
    return;
  }
  const result = await resend.emails.send({
    from: emailFrom(),
    to: adminEmail(),
    subject: `[Feedback: ${oneLine(type)}] ${oneLine(title)}`,
    html: feedbackNotificationHtml({ type, title, description, submitter }),
  });
  if (result.error) reportSendFailure("feedback alert", result.error);
}

export type { IcsBooking, IcsMethod };

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
    subject: `How was your lesson, ${firstName(name, "there")}?`,
    html: reviewRequestHtml({ name, lessonName, lessonDate, reviewUrl }),
    replyTo: adminEmail(),
  });
  if (result.error) {
    reportSendFailure("review request", result.error);
    return false;
  }
  return true;
}

/** The day-before reminder. Returns false when it was not sent, so the cron can retry. */
export async function sendLessonReminderEmail(booking: IcsBooking): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping lesson reminder");
    return false;
  }
  const result = await resend.emails.send({
    from: emailFrom(),
    to: booking.email,
    subject: `Tomorrow: ${lessonName(booking.lesson_type)} at ${oneLine(booking.lesson_time)} CT`,
    html: lessonReminderHtml(booking),
    replyTo: adminEmail(),
  });
  if (result.error) {
    reportSendFailure("lesson reminder", result.error);
    return false;
  }
  return true;
}

/** Mario's morning digest of lessons that still need an outcome. */
export async function sendLessonOutcomeDigest(lessons: OutcomeDigestLesson[]): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping lesson outcome digest");
    return false;
  }
  const first = lessons[0];
  // "Jane S.", as the spec's contract says: subjects show on lock screens.
  const subject =
    lessons.length === 1
      ? `Did it happen? ${first.lessonName} with ${oneLine(shortName(first.name))}`
      : `${lessons.length} lessons need an outcome`;
  const result = await resend.emails.send({
    from: emailFrom(),
    to: adminEmail(),
    subject,
    html: lessonOutcomeDigestHtml(lessons),
  });
  if (result.error) {
    reportSendFailure("lesson outcome digest", result.error);
    return false;
  }
  return true;
}
