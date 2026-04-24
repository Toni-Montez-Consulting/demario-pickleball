import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, isAdminEmail } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function sortKeyFor(display: string): number | null {
  const m = display.trim().match(TIME_RE);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const mer = m[3].toUpperCase();
  if (hour === 12) hour = 0;
  if (mer === "PM") hour += 12;
  return hour * 60 + minute;
}

function normalizeDisplay(display: string): string | null {
  const m = display.trim().match(TIME_RE);
  if (!m) return null;
  return `${parseInt(m[1], 10)}:${m[2]} ${m[3].toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("all") === "true";

  if (includeInactive) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase
      .from("time_slots")
      .select("*")
      .order("sort_key", { ascending: true });
    if (error) {
      console.error("[time-slots GET all]", error);
      return NextResponse.json({ error: "Failed to load time slots." }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const supabase = anonClient();
  const { data, error } = await supabase
    .from("time_slots")
    .select("display_label, sort_key")
    .eq("active", true)
    .order("sort_key", { ascending: true });
  if (error) {
    console.error("[time-slots GET]", error);
    return NextResponse.json({ error: "Failed to load time slots." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawLabel = body?.display_label;
  if (typeof rawLabel !== "string") {
    return NextResponse.json({ error: "Missing display_label" }, { status: 400 });
  }
  const display = normalizeDisplay(rawLabel);
  const sortKey = sortKeyFor(rawLabel);
  if (!display || sortKey === null) {
    return NextResponse.json({ error: "Use format like '7:00 AM' or '5:30 PM'." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("time_slots")
    .insert({ display_label: display, sort_key: sortKey, active: true })
    .select()
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "That time slot already exists." }, { status: 409 });
  }
  if (error) {
    console.error("[time-slots POST]", error);
    return NextResponse.json({ error: "Failed to create time slot." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
