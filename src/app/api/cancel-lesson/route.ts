import { NextRequest, NextResponse, after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { outcomeSecret } from "@/lib/lesson-outcomes";
import { verifyCancelToken, type CancelFailure } from "@/lib/lesson-cancel";
import { sendBookingCancelledEmail } from "@/lib/email/client";
import { lessonHasStarted, parseDisplayTime } from "@/lib/time";

// base64url payload, a dot, base64url signature: the only shape a real link has.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

async function readToken(req: NextRequest): Promise<string> {
  const form = await req.formData().catch(() => null);
  const value = form?.get("token");
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Cancels one lesson from the confirmation page's button: the same change and
 * the same student email as Admin's Cancel. The signed token is the
 * authorisation, and it is narrow: one booking, and only a pending lesson that
 * has not started.
 * Design: docs/specs/2026-10-23-one-tap-cancel.md
 */
export async function POST(req: NextRequest) {
  const token = await readToken(req);
  if (!token || token.length > 512 || !TOKEN_SHAPE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // Every result goes back to the page, which re-reads the booking and says
  // what happened. 303 turns the POST into a GET.
  const backToPage = (failed?: CancelFailure) => {
    const url = new URL(`/cancel-lesson/${token}`, req.url);
    if (failed) url.searchParams.set("failed", failed);
    return NextResponse.redirect(url, 303);
  };

  const secret = outcomeSecret();
  if (!secret) {
    console.error("[cancel-lesson POST] LESSON_OUTCOME_SECRET is not set");
    return backToPage();
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "cancel_lesson",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) return backToPage("busy");

  const check = verifyCancelToken(token, secret);
  if (!check.ok) return backToPage();

  const { data: booking, error: loadError } = await supabase
    .from("bookings")
    .select("id,name,email,status,lesson_type,lesson_date,lesson_time")
    .eq("id", check.bookingId)
    .maybeSingle();
  if (loadError) {
    console.error("[cancel-lesson POST] booking lookup failed", check.bookingId, loadError);
    return backToPage("save");
  }
  // The page explains a missing, settled, started, or unreadable lesson. An
  // unreadable time is refused: it cannot be shown that the lesson is ahead.
  if (!booking || booking.status !== "pending") return backToPage();
  if (!parseDisplayTime(booking.lesson_time)) return backToPage();
  if (lessonHasStarted(booking.lesson_date, booking.lesson_time)) return backToPage();

  // Only a still-pending booking moves, and only the request that moved it
  // emails the student, so a double tap sends one email.
  const { data: moved, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error("[cancel-lesson POST] update failed", booking.id, error);
    return backToPage("save");
  }

  if (moved && moved.length > 0) {
    // The student's notice, as Admin's Cancel sends it. after() keeps the
    // function alive until the email is handed to Resend.
    after(() =>
      sendBookingCancelledEmail({
        id: booking.id,
        name: booking.name,
        email: booking.email,
        lesson_type: booking.lesson_type,
        lesson_date: booking.lesson_date,
        lesson_time: booking.lesson_time,
      }).catch((err) => console.error("[cancel-lesson POST] cancel email failed", booking.id, err))
    );
  }
  return backToPage();
}
