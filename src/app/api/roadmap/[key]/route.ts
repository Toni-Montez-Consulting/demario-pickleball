import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

const KEY_RE = /^[a-z0-9-]{2,30}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { key } = await params;
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.checked !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await admin.supabase
    .from("roadmap_checks")
    .upsert({ key, checked: body.checked, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error("[roadmap PATCH]", error);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }
  return NextResponse.json(data);
}
