import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { sendBookingCancelledEmail } from "@/lib/email/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

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

  if (update.status === "confirmed") {
    const { data: existing, error: fetchError } = await admin.supabase
      .from("bookings")
      .select("status")
      .eq("id", id)
      .single();
    if (fetchError?.code === "PGRST116" || !existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (fetchError) {
      console.error("[bookings PATCH existing]", fetchError);
      return NextResponse.json({ error: "Failed to update booking." }, { status: 500 });
    }
    if (existing.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled bookings cannot be confirmed." }, { status: 409 });
    }
  }

  const { data, error } = await admin.supabase
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

  if (update.status === "cancelled") {
    sendBookingCancelledEmail({
      id: data.id,
      name: data.name,
      email: data.email,
      lesson_type: data.lesson_type,
      lesson_date: data.lesson_date,
      lesson_time: data.lesson_time,
    }).catch((err) => console.error("[bookings PATCH] cancel email failed", err));
  }

  return NextResponse.json(data);
}
