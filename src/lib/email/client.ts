import { Resend } from "resend";
import { generateIcs, type IcsBooking, type IcsMethod } from "./ics";
import {
  studentRequestedHtml,
  adminNotificationHtml,
  studentCancelledHtml,
  feedbackNotificationHtml,
  reviewRequestHtml,
  inquiryNotificationHtml,
  lessonOutcomeDigestHtml,
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

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

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
  const lesson = LESSON_NAMES[booking.lesson_type] ?? booking.lesson_type;

  const studentResult = await resend.emails.send({
    from: emailFrom(),
    to: booking.email,
    subject: `You're booked — ${lesson} on ${booking.lesson_date}`,
    html: studentRequestedHtml(booking),
    attachments: [{ filename, content: icsContent, contentType: "text/calendar; method=REQUEST" }],
    // Without this a student replying to their confirmation hits the no-reply
    // sending domain and bounces. Mario never sees the question.
    replyTo: adminEmail(),
  });
  if (studentResult.error) {
    console.error("[email] student confirmation failed", studentResult.error);
  }

  const adminResult = await resend.emails.send({
    from: emailFrom(),
    to: adminEmail(),
    subject: `New booking — ${booking.name} · ${booking.lesson_date} ${booking.lesson_time}`,
    html: adminNotificationHtml(booking),
    replyTo: booking.email,
  });
  if (adminResult.error) {
    console.error("[email] admin notification failed", adminResult.error);
  }
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
  // The name is free text from a public form. Keep it to one line so it cannot
  // add lines to the subject header.
  const sender = inquiry.name.replace(/[\r\n]+/g, " ").trim();
  const result = await resend.emails.send({
    from: emailFrom(),
    to: adminEmail(),
    subject: `New message — ${sender}`,
    html: inquiryNotificationHtml(inquiry),
    replyTo: inquiry.email,
  });
  if (result.error) {
    console.error("[email] inquiry notification failed", result.error);
  }
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
    subject: `Cancelled: your lesson on ${booking.lesson_date}`,
    html: studentCancelledHtml(booking),
    attachments: [{ filename, content: icsContent, contentType: "text/calendar; method=CANCEL" }],
    replyTo: adminEmail(),
  });
  if (result.error) {
    console.error("[email] cancellation email failed", result.error);
  }
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
    subject: `[Feedback: ${type}] ${title}`,
    html: feedbackNotificationHtml({ type, title, description, submitter }),
  });
  if (result.error) {
    console.error("[email] feedback notification failed", result.error);
  }
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
  const first = name.trim().split(/\s+/)[0] || "there";
  const result = await resend.emails.send({
    from: emailFrom(),
    to,
    subject: `How was your lesson, ${first}?`,
    html: reviewRequestHtml({ name, lessonName, lessonDate, reviewUrl }),
    replyTo: adminEmail(),
  });
  if (result.error) {
    console.error("[email] review request failed", result.error);
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
  const subject =
    lessons.length === 1
      ? `Did it happen? ${first.lessonName} with ${first.name.replace(/[\r\n]+/g, " ").trim()}`
      : `${lessons.length} lessons need an outcome`;
  const result = await resend.emails.send({
    from: emailFrom(),
    to: adminEmail(),
    subject,
    html: lessonOutcomeDigestHtml(lessons),
  });
  if (result.error) {
    console.error("[email] lesson outcome digest failed", result.error);
    return false;
  }
  return true;
}
