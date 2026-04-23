import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const VALID_LESSON_TYPES = ["beginner", "advanced", "clinic"] as const;
const VALID_TIMES = ["7:00 AM", "9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:30 PM"];
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
  if (typeof name !== "string" || name.length > 120) {
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
  if (!VALID_TIMES.includes(lesson_time)) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }

  const supabase = anonClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? String(phone).slice(0, 20) : null,
      lesson_type,
      lesson_date,
      lesson_time,
      notes: notes ? String(notes).slice(0, 500) : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("lesson_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
