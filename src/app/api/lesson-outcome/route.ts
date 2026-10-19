import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { outcomeSecret, verifyOutcomeToken } from "@/lib/lesson-outcomes";

/** The confirmation page posts a form; JSON is accepted for tests and scripts. */
async function readToken(req: NextRequest): Promise<string> {
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = await req.json().catch(() => null);
    return typeof body?.token === "string" ? body.token.trim() : "";
  }
  const form = await req.formData().catch(() => null);
  const value = form?.get("token");
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Records a lesson outcome from the confirmation page's button. This is the
 * only path in that flow that changes data; the emailed link itself is a GET
 * that only renders the page.
 * Design: docs/specs/2026-10-19-lesson-outcome-nudge.md
 *
 * No admin session is required. The signed token is the authorisation, and it
 * is deliberately narrow: one booking, one outcome, 14 days, and only out of
 * `pending`. No email is sent from here.
 */
export async function POST(req: NextRequest) {
  const secret = outcomeSecret();
  if (!secret) {
    console.error("[lesson-outcome POST] LESSON_OUTCOME_SECRET is not set");
    return NextResponse.json({ error: "Outcome links are not configured" }, { status: 503 });
  }

  const token = await readToken(req);
  if (!token || token.length > 512) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "lesson_outcome",
    limit: 30,
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

  // The page re-checks the token and the booking and explains the result, so
  // every outcome goes back there. 303 turns the POST into a GET.
  const backToPage = NextResponse.redirect(
    new URL(`/lesson-outcome/${encodeURIComponent(token)}`, req.url),
    303
  );

  const check = verifyOutcomeToken(token, secret);
  if (!check.ok) return backToPage;

  // Only a pending booking moves. A replayed link, or a second button tapped
  // from the same email, finds no pending row and changes nothing.
  const { error } = await supabase
    .from("bookings")
    .update({ status: check.outcome })
    .eq("id", check.bookingId)
    .eq("status", "pending");

  if (error) {
    console.error("[lesson-outcome POST] update failed", check.bookingId, error);
    return NextResponse.json({ error: "Could not record the outcome" }, { status: 500 });
  }
  return backToPage;
}
