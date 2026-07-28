import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Must be dynamic. With ISR this route was prerendered at build time and the
// snapshot reused, so a review Mario published could fail to appear at all —
// the database is the source of truth for content he edits. Caching is done at
// the CDN with an explicit header below instead, which is bounded and legible.
export const dynamic = "force-dynamic";

/**
 * Published reviews for the homepage. Public and unauthenticated.
 *
 * Returns an empty array on error rather than a 500: a database hiccup must not
 * break the homepage. The trade-off is that the wall silently empties, so the
 * failure is reported to Sentry explicitly — console.error alone does NOT reach
 * Sentry with this project's configuration.
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
    Sentry.captureException(error, { tags: { route: "reviews/published" } });
    // Never break the homepage over a database hiccup. Do not cache the failure.
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(data ?? [], {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
