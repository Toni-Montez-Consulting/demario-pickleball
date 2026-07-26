import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 300;

/**
 * Published reviews for the homepage. Public and unauthenticated.
 *
 * Returns an empty array on error rather than a 500: a database hiccup must
 * not break the homepage. The error is still logged and reaches Sentry.
 */
export async function GET() {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id,rating,body,display_name,lesson_context,tag,takeaway,verified_booking,published_at")
    .eq("status", "published")
    .not("body", "is", null)
    .order("verified_booking", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[reviews published GET]", error);
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}
