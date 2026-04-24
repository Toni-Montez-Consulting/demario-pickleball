import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("time_slots")
    .update({ active: body.active })
    .eq("id", id)
    .select()
    .single();

  if (error?.code === "PGRST116" || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error) {
    console.error("[time-slots PATCH]", error);
    return NextResponse.json({ error: "Failed to update time slot." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error } = await admin.supabase.from("time_slots").delete().eq("id", id).select().single();
  if (error?.code === "PGRST116") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error) {
    console.error("[time-slots DELETE]", error);
    return NextResponse.json({ error: "Failed to delete time slot." }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
