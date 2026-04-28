import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient, requireAdmin } from "@/lib/supabase/server";
import { sendBookingCreatedEmails } from "@/lib/email/client";
import { assertBookableSlot } from "@/lib/availability";
import { WAIVER_VERSION } from "@/lib/business";
import { checkRateLimit } from "@/lib/rate-limit";
import { isCourtSetup, parseBookingNotes } from "@/lib/booking-notes";

const VALID_LESSON_TYPES = ["beginner", "advanced", "clinic"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, email, phone, lesson_type, lesson_date, lesson_time, notes, waiver_accepted, company } = body;

  if (typeof company === "string" && company.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "bookings",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

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
  const trimmedPhone = typeof phone === "string" ? phone.trim() : "";
  if (!/^[\d\s\-()+]{7,20}$/.test(trimmedPhone) || trimmedPhone.replace(/\D/g, "").length < 7) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }
  const trimmedNotes = (typeof notes === "string" && notes.trim()) ? notes.trim().slice(0, 500) : null;
  const parsedNotes = parseBookingNotes(trimmedNotes);
  if (!isCourtSetup(parsedNotes.courtSetup)) {
    return NextResponse.json({ error: "Preferred court setup is required." }, { status: 400 });
  }
  if (waiver_accepted !== true) {
    return NextResponse.json({ error: "You must agree to the coaching terms before booking." }, { status: 400 });
  }

  const availabilityError = await assertBookableSlot(supabase, lesson_date, lesson_time, lesson_type);
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
      phone: trimmedPhone.slice(0, 20),
      lesson_type,
      lesson_date,
      lesson_time,
      notes: trimmedNotes,
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
    phone: data.phone,
    lesson_type: data.lesson_type,
    lesson_date: data.lesson_date,
    lesson_time: data.lesson_time,
    notes: data.notes,
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
