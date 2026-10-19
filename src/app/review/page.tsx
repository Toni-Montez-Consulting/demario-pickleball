import ReviewForm from "@/components/ReviewForm";
import { pageMetadata } from "@/lib/metadata";

// DeMario texts this link to past students, so it must preview as itself
// rather than inherit the homepage's title.
export const metadata = pageMetadata({
  path: "/review",
  title: "Leave a review · DeMario Montez Pickleball",
  description: "Share your experience training with DeMario Montez.",
  index: false,
});

/**
 * The link Mario shares with past clients who never booked through the site.
 * Submissions are flagged unverified and still require his approval.
 */
export default function PublicReviewPage() {
  return (
    <main className="review-page">
      <h1>How was your lesson?</h1>
      <p>
        Took a lesson, clinic, or drilling session with DeMario? Tell him how it went.
      </p>
      <ReviewForm />
    </main>
  );
}
