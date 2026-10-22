import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { sendBookingCancelledEmail } from "@/lib/email/client";
import { lessonHasStarted } from "@/lib/time";

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
    // no_show records a booking the student did not attend. It sends no email
    // and excludes the booking from the review request cron.
    if (!["confirmed", "cancelled", "no_show"].includes(status)) {
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
      .select("status,lesson_date,lesson_time")
      .eq("id", id)
      .single();
    // PGRST116 is "no row". Any other error is a failed lookup, which must not
    // read as a missing booking.
    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[bookings PATCH existing]", fetchError);
      return NextResponse.json({ error: "Failed to update booking." }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.status === "cancelled") {
      return NextResponse.json({ error: "Cancelled bookings cannot be confirmed." }, { status: 409 });
    }
    // "Confirmed" is what the review cron reads as "the lesson happened". Set
    // before the lesson, say while confirming the court by text, it would send
    // a review request even if the lesson were rained out.
    if (!lessonHasStarted(existing.lesson_date, existing.lesson_time)) {
      return NextResponse.json(
        { error: "A lesson can be marked as happened once it has started." },
        { status: 409 }
      );
    }
  }

  const { data, error } = await admin.supabase
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  // Reactivating a booking (for example no_show back to confirmed) brings it back
  // inside the overlap constraint. If something else was booked into that time in
  // the meantime the constraint fires, and a bare 500 would leave Mario guessing.
  if (error?.code === "23P01" || error?.code === "23505") {
    console.warn("[bookings PATCH] status change would overlap another booking", id);
    return NextResponse.json(
      { error: "Another booking now overlaps that time. Cancel or move it first." },
      { status: 409 }
    );
  }
  if (error && error.code !== "PGRST116") {
    console.error("[bookings PATCH]", error);
    return NextResponse.json({ error: "Failed to update booking." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // The student's only notice. after() keeps the function alive until it is
  // sent; a bare promise can be frozen once the response goes out. A lesson that
  // has already started gets no email: cancelling it records that it didn't
  // happen (Admin's Needs outcome list), and "your lesson was cancelled" weeks
  // later would only confuse the student.
  if (update.status === "cancelled" && !lessonHasStarted(data.lesson_date, data.lesson_time)) {
    after(() =>
      sendBookingCancelledEmail({
        id: data.id,
        name: data.name,
        email: data.email,
        lesson_type: data.lesson_type,
        lesson_date: data.lesson_date,
        lesson_time: data.lesson_time,
      }).catch((err) => console.error("[bookings PATCH] cancel email failed", err))
    );
  }

  return NextResponse.json(data);
}
