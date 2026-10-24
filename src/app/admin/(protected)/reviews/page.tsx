import { requireAdminPage } from "@/lib/supabase/server";
import ReviewsDashboard from "@/components/ReviewsDashboard";

export const metadata = { title: "Reviews · Admin" };

export default async function ReviewsPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase
    .from("reviews")
    .select("*")
    // Only rows a student actually submitted. Tokenized rows created by the
    // cron carry placeholders until they are filled in.
    .or("token_hash.is.null,token_used_at.not.is.null")
    .order("created_at", { ascending: false });

  return <ReviewsDashboard initialReviews={data ?? []} />;
}
