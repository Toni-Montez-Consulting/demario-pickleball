import { createServiceRoleClient } from "@/lib/supabase/server";
import ReviewsDashboard from "@/components/ReviewsDashboard";

export const metadata = { title: "Reviews · Admin" };

export default async function ReviewsPage() {
  // The (protected) layout enforces session + AAL2 before this renders.
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    // Only rows a student actually submitted. Tokenized rows created by the
    // cron carry placeholders until they are filled in.
    .or("token_hash.is.null,token_used_at.not.is.null")
    .order("created_at", { ascending: false });

  return <ReviewsDashboard initialReviews={data ?? []} />;
}
