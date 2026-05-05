import { Resend } from "resend";
import { generateIcs, type IcsBooking, type IcsMethod } from "./ics";
import { studentRequestedHtml, adminNotificationHtml, studentCancelledHtml, feedbackNotificationHtml } from "./templates";

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
