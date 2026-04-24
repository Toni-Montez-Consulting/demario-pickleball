import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { status, paid } = body;

  const update: { status?: string; paid_at?: string | null } = {};
  if (status !== undefined) {
    if (!["confirmed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = status;
  }
  if (paid !== undefined) {
    if (typeof paid !== "boolean") {
      return NextResponse.json({ error: "Invalid paid value" }, { status: 400 });
    }
    update.paid_at = paid ? new Date().toISOString() : null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error?.code === "PGRST116" || !data) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (error) {
    console.error("[bookings PATCH]", error);
    return NextResponse.json({ error: "Failed to update booking." }, { status: 500 });
  }
  return NextResponse.json(data);
}
