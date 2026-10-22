import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/ReviewForm";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { lessonName } from "@/lib/lesson-types";
import { formatLessonDate } from "@/lib/time";
import { hashReviewToken } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Leave a review · DeMario Montez Pickleball",
  robots: { index: false, follow: false },
};

/** The private link emailed 24 hours after a lesson. */
export default async function TokenReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: review } = await supabase
    .from("reviews")
    .select("id,token_used_at,display_name,booking_id")
    .eq("token_hash", hashReviewToken(token))
    .maybeSingle();

  if (!review) notFound();

  if (review.token_used_at) {
    return (
      <main className="review-page">
        <h1>Thank you.</h1>
        <p>You have already left this review. DeMario has it.</p>
      </main>
    );
  }

  let lessonLabel: string | undefined;
  if (review.booking_id) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("lesson_type,lesson_date")
      .eq("id", review.booking_id)
      .maybeSingle();
    if (booking) {
      lessonLabel = `${lessonName(booking.lesson_type)} on ${formatLessonDate(booking.lesson_date)}`;
    }
  }

  return (
    <main className="review-page">
      <h1>How was your lesson?</h1>
      <ReviewForm token={token} lessonLabel={lessonLabel} defaultName={review.display_name} />
    </main>
  );
}
