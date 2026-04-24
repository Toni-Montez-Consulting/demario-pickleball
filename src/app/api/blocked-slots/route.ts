import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VALID_TIMES = ["7:00 AM", "9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:30 PM"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("blocked_slots")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    console.error("[blocked-slots GET]", error);
    return NextResponse.json({ error: "Failed to load blocked slots." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { date, time } = body ?? {};

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const today = new Date().toISOString().split("T")[0];
  if (date < today) {
    return NextResponse.json({ error: "Cannot block a date in the past" }, { status: 400 });
  }
  if (!VALID_TIMES.includes(time)) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("blocked_slots")
    .insert({ date, time })
    .select()
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "Slot already blocked" }, { status: 409 });
  }
  if (error) {
    console.error("[blocked-slots POST]", error);
    return NextResponse.json({ error: "Failed to block slot." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
