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
  if (typeof body?.read !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("inquiries")
    .update({ read: body.read })
    .eq("id", id)
    .select()
    .single();

  if (error?.code === "PGRST116") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error) {
    console.error("[inquiries PATCH]", error);
    return NextResponse.json({ error: "Failed to update inquiry." }, { status: 500 });
  }
  return NextResponse.json(data);
}
