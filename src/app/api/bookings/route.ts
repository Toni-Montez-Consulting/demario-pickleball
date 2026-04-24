import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, requireAdmin } from "@/lib/supabase/server";
import { sendBookingCreatedEmails } from "@/lib/email/client";
import { assertBookableSlot } from "@/lib/availability";
import { WAIVER_VERSION } from "@/lib/business";

const VALID_LESSON_TYPES = ["beginner", "advanced", "clinic"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, email, phone, lesson_type, lesson_date, lesson_time, notes, waiver_accepted } = body;

  if (!name || !email || !lesson_type || !lesson_date || !lesson_time) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim() || name.length > 120) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!VALID_LESSON_TYPES.includes(lesson_type)) {
    return NextResponse.json({ error: "Invalid lesson type" }, { status: 400 });
  }
  if (typeof lesson_time !== "string") {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }
  if (phone && (typeof phone !== "string" || !/^[\d\s\-()+]{7,20}$/.test(phone))) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }
  if (waiver_accepted !== true) {
    return NextResponse.json({ error: "You must agree to the coaching terms before booking." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const availabilityError = await assertBookableSlot(supabase, lesson_date, lesson_time);
  if (availabilityError) {
    return NextResponse.json(
      { error: availabilityError.error },
      { status: availabilityError.status }
    );
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? String(phone).trim().slice(0, 20) : null,
      lesson_type,
      lesson_date,
      lesson_time,
      notes: (typeof notes === "string" && notes.trim()) ? notes.trim().slice(0, 500) : null,
      waiver_signed_at: new Date().toISOString(),
      waiver_version: WAIVER_VERSION,
    })
    .select()
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "That time slot was just booked. Please pick another." }, { status: 409 });
  }
  if (error) {
    console.error("[bookings POST]", error);
    return NextResponse.json({ error: "Booking failed. Please try again." }, { status: 500 });
  }

  sendBookingCreatedEmails({
    id: data.id,
    name: data.name,
    email: data.email,
    lesson_type: data.lesson_type,
    lesson_date: data.lesson_date,
    lesson_time: data.lesson_time,
  }).catch((err) => console.error("[bookings POST] email send failed", err));

  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
    .from("bookings")
    .select("*")
    .order("lesson_date", { ascending: true });

  if (error) {
    console.error("[bookings GET]", error);
    return NextResponse.json({ error: "Failed to load bookings." }, { status: 500 });
  }
  return NextResponse.json(data);
}
