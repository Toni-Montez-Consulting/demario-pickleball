import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse, after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendInquiryNotificationEmail } from "@/lib/email/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Each alert spends the same Resend quota as booking emails (100 a day on the
// free plan), and one client may send 10 messages an hour. Past this many in a
// day, messages still land in /admin but stop emailing, so spam cannot starve
// the booking alerts.
const INQUIRY_ALERTS_PER_DAY = 20;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, email, message, company } = body;
  if (typeof company === "string" && company.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "inquiries",
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim() || name.length > 120) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("[inquiries POST]", error);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }

  // Inquiries used to land only in /admin, which nobody was watching. Email
  // Mario after the response so a slow send never holds up the student.
  after(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    // A failed count leaves `count` null, and the alert still goes out.
    if (count !== null && count > INQUIRY_ALERTS_PER_DAY) {
      if (count === INQUIRY_ALERTS_PER_DAY + 1) {
        Sentry.captureMessage(
          `Inquiry alerts paused: more than ${INQUIRY_ALERTS_PER_DAY} messages in 24 hours`,
          "warning"
        );
      }
      return;
    }
    await sendInquiryNotificationEmail({
      name: data.name,
      email: data.email,
      message: data.message,
    }).catch((err) => console.error("[inquiries POST] notification failed", err));
  });

  return NextResponse.json(data, { status: 201 });
}
