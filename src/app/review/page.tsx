import type { Metadata } from "next";
import ReviewForm from "@/components/ReviewForm";

export const metadata: Metadata = {
  title: "Leave a review · DeMario Montez Pickleball",
  description: "Share your experience training with DeMario Montez.",
  robots: { index: false, follow: false },
};

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
