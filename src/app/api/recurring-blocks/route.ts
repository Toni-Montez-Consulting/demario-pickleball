import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, isAdminEmail } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("recurring_blocks")
    .select("*")
    .order("day_of_week", { ascending: true });
  if (error) {
    console.error("[recurring-blocks GET]", error);
    return NextResponse.json({ error: "Failed to load recurring blocks." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const day = body?.day_of_week;
  const time = body?.time;

  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) {
    return NextResponse.json({ error: "day_of_week must be 0–6" }, { status: 400 });
  }

  let timeValue: string | null = null;
  if (time !== undefined && time !== null && time !== "") {
    if (typeof time !== "string") {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }
    const { data: slot } = await supabase
      .from("time_slots")
      .select("display_label")
      .eq("display_label", time)
      .maybeSingle();
    if (!slot) {
      return NextResponse.json({ error: "Unknown time slot" }, { status: 400 });
    }
    timeValue = slot.display_label;
  }

  const { data, error } = await supabase
    .from("recurring_blocks")
    .insert({ day_of_week: day, time: timeValue })
    .select()
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "That recurring block already exists." }, { status: 409 });
  }
  if (error) {
    console.error("[recurring-blocks POST]", error);
    return NextResponse.json({ error: "Failed to add recurring block." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
