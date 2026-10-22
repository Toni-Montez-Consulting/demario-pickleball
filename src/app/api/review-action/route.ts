import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  moderationSecret,
  verifyReviewActionToken,
  type ReviewActionFailure,
} from "@/lib/review-moderation";

// base64url payload, a dot, base64url signature: the only shape a real link
// has. Checked before the token goes into a URL.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

async function readToken(req: NextRequest): Promise<string> {
  const form = await req.formData().catch(() => null);
  const value = form?.get("token");
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Takes a review down or publishes it from the confirmation page's button.
 * The emailed link is only a GET that renders that page.
 * Design: docs/specs/2026-10-22-automatic-reviews.md
 *
 * No admin session is required: the signed token is the authorisation, and it
 * is narrow. One review, one action, 60 days. "hide" takes a live or waiting
 * review down; "publish" moves only a waiting review live, so it cannot undo a
 * takedown. Admin can do anything either way.
 */
export async function POST(req: NextRequest) {
  const token = await readToken(req);
  if (!token || token.length > 512 || !TOKEN_SHAPE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // A browser form post: every result goes back to the page, which re-checks
  // the link and the review and explains what happened. 303 turns the POST
  // into a GET.
  const backToPage = (failed?: ReviewActionFailure) => {
    const url = new URL(`/review-action/${token}`, req.url);
    if (failed) url.searchParams.set("failed", failed);
    return NextResponse.redirect(url, 303);
  };

  const secret = moderationSecret();
  if (!secret) {
    console.error("[review-action POST] LESSON_OUTCOME_SECRET is not set");
    return backToPage();
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "review_action",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) return backToPage("busy");

  const check = verifyReviewActionToken(token, secret);
  if (!check.ok) return backToPage();

  const query =
    check.action === "hide"
      ? supabase
          .from("reviews")
          .update({ status: "hidden", published_at: null })
          .eq("id", check.reviewId)
          .neq("status", "hidden")
      : supabase
          .from("reviews")
          .update({ status: "published", published_at: new Date().toISOString() })
          .eq("id", check.reviewId)
          .eq("status", "pending");

  const { error } = await query;
  if (error) {
    console.error("[review-action POST] update failed", check.reviewId, check.action, error);
    return backToPage("save");
  }
  console.info("[review-action POST]", check.action, check.reviewId);
  return backToPage();
}
