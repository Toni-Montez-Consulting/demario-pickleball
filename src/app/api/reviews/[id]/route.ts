import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * Publish or hide a review, and optionally set Mario's editorial labels.
 *
 * There is deliberately no path here to change `body` or `rating`. A published
 * review is the student's words or it is worth nothing. `tag` and `takeaway`
 * are Mario's own labels, not the student's, and a non-null takeaway is what
 * promotes a review into the featured carousel.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const update: {
    status?: string;
    published_at?: string | null;
    tag?: string | null;
    takeaway?: string | null;
  } = {};

  if (body.status !== undefined) {
    if (!["published", "hidden"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
    update.published_at = body.status === "published" ? new Date().toISOString() : null;
  }

  for (const field of ["tag", "takeaway"] as const) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") {
      update[field] = null;
      continue;
    }
    if (typeof body[field] !== "string" || body[field].length > 120) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
    update[field] = body[field].trim();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("reviews")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error?.code === "PGRST116" || !data) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (error) {
    console.error("[reviews PATCH]", error);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error } = await admin.supabase.from("reviews").delete().eq("id", id);
  if (error) {
    console.error("[reviews DELETE]", error);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
