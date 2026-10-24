import type { Metadata } from "next";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  moderationSecret,
  reviewActionView,
  verifyReviewActionToken,
  type ModerationReview,
} from "@/lib/review-moderation";

export const metadata: Metadata = {
  title: "Review · DeMario Montez Pickleball",
  robots: { index: false, follow: false },
};

/**
 * Where "Take it down" or "Publish it" in DeMario's review email lands.
 * Rendering it changes nothing: mail scanners fetch every link in an email,
 * so only the button below (a form POST) acts.
 * Design: docs/specs/2026-10-22-automatic-reviews.md
 */
export default async function ReviewActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ failed?: string | string[] }>;
}) {
  const { token: raw } = await params;
  const { failed: failedParam } = await searchParams;
  const failed = failedParam === "save" || failedParam === "busy" ? failedParam : null;
  // A malformed %-sequence must render "isn't valid", not a server error.
  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    // Keep the raw value; verification will reject it.
  }
  const secret = moderationSecret();
  const check = secret ? verifyReviewActionToken(token, secret) : null;

  let review: ModerationReview | null = null;
  let loadFailed = false;
  if (check?.ok) {
    const { data, error } = await createServiceRoleClient()
      .from("reviews")
      .select("rating,body,display_name,status,verified_booking")
      .eq("id", check.reviewId)
      .maybeSingle();
    if (error) {
      console.error("[review-action page] review lookup failed", check.reviewId, error);
      loadFailed = true;
    }
    review = data;
  }

  const view = reviewActionView({ configured: Boolean(secret), check, review, loadFailed, failed });

  return (
    <main className="outcome-page">
      <p className="kicker">Review</p>
      <h1>{view.heading}</h1>
      {view.state === "ready" ? (
        <>
          {view.alert && (
            <p className="outcome-alert" role="alert">
              {view.alert}
            </p>
          )}
          <dl className="outcome-facts">
            <div>
              <dt>Rating</dt>
              <dd aria-label={`${view.review.rating} out of 5`}>{view.review.stars}</dd>
            </div>
            <div>
              <dt>Shown as</dt>
              <dd>{view.review.name}</dd>
            </div>
            {view.review.body && (
              <div>
                <dt>Review</dt>
                <dd>{view.review.body}</dd>
              </div>
            )}
            <div>
              <dt>Came from</dt>
              <dd>{view.review.source}</dd>
            </div>
          </dl>
          <form method="post" action="/api/review-action">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary btn-full">
              {view.button}
            </button>
          </form>
          <p className="outcome-note">{view.note}</p>
        </>
      ) : (
        <p className="outcome-note">{view.body}</p>
      )}
      <Link className="btn btn-ghost btn-full" href="/admin">
        {view.state === "ready" ? "Open Admin instead" : "Open Admin"}
      </Link>
    </main>
  );
}
