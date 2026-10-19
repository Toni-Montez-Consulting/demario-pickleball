import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { outcomeSecret, verifyOutcomeToken, type OutcomeFailure } from "@/lib/lesson-outcomes";

// base64url payload, a dot, base64url signature: the only shape a real link
// has. Checked before the token goes into a URL.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** The token from the confirmation page's form. */
async function readToken(req: NextRequest): Promise<string> {
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
  const token = await readToken(req);
  if (!token || token.length > 512 || !TOKEN_SHAPE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // This is a browser form post, so every result goes back to the page rather
  // than leaving Mario on raw JSON. The page re-checks the token and the booking
  // and explains the result; ?failed= tells it nothing was saved. 303 turns the
  // POST into a GET.
  const backToPage = (failed?: OutcomeFailure) => {
    const url = new URL(`/lesson-outcome/${token}`, req.url);
    if (failed) url.searchParams.set("failed", failed);
    return NextResponse.redirect(url, 303);
  };

  const secret = outcomeSecret();
  if (!secret) {
    // The page says outcome links are not set up yet.
    console.error("[lesson-outcome POST] LESSON_OUTCOME_SECRET is not set");
    return backToPage();
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "lesson_outcome",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) return backToPage("busy");

  const check = verifyOutcomeToken(token, secret);
  if (!check.ok) return backToPage();

  // Only a pending booking moves. A replayed link, or a second button tapped
  // from the same email, finds no pending row and changes nothing.
  const { error } = await supabase
    .from("bookings")
    .update({ status: check.outcome })
    .eq("id", check.bookingId)
    .eq("status", "pending");

  if (error) {
    console.error("[lesson-outcome POST] update failed", check.bookingId, error);
    return backToPage("save");
  }
  return backToPage();
}
