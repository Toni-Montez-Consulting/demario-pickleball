import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, isAdminEmail } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingCreatedEmails } from "@/lib/email/client";

const VALID_LESSON_TYPES = ["beginner", "advanced", "clinic"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, email, phone, lesson_type, lesson_date, lesson_time, notes } = body;

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lesson_date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (lesson_date <= yesterday.toISOString().split("T")[0]) {
    return NextResponse.json({ error: "Cannot book a date in the past" }, { status: 400 });
  }
  if (typeof lesson_time !== "string") {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }
  if (phone && (typeof phone !== "string" || !/^[\d\s\-()+]{7,20}$/.test(phone))) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const supabase = anonClient();

  const { data: slot } = await supabase
    .from("time_slots")
    .select("display_label")
    .eq("display_label", lesson_time)
    .eq("active", true)
    .maybeSingle();
  if (!slot) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }

  const { data: blockedSlots } = await supabase
    .from("blocked_slots")
    .select("id, all_day, time")
    .eq("date", lesson_date);
  const isBlocked = (blockedSlots ?? []).some((b) => b.all_day || b.time === lesson_time);
  if (isBlocked) {
    return NextResponse.json({ error: "That time slot is not available." }, { status: 409 });
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
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("lesson_date", { ascending: true });

  if (error) {
    console.error("[bookings GET]", error);
    return NextResponse.json({ error: "Failed to load bookings." }, { status: 500 });
  }
  return NextResponse.json(data);
}
