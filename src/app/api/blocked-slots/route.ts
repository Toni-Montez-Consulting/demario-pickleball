import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await admin.supabase
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
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await req.json().catch(() => null);
  const { date, time, all_day } = body ?? {};

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date <= yesterday.toISOString().split("T")[0]) {
    return NextResponse.json({ error: "Cannot block a date in the past" }, { status: 400 });
  }

  const blockWholeDay = all_day === true;
  let validatedTime: string | null = null;

  if (!blockWholeDay) {
    if (typeof time !== "string") {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }
    const { data: slot } = await admin.supabase
      .from("time_slots")
      .select("display_label")
      .eq("display_label", time)
      .maybeSingle();
    if (!slot) {
      return NextResponse.json({ error: "Invalid time" }, { status: 400 });
    }
    validatedTime = slot.display_label;
  }

  const { data, error } = await admin.supabase
    .from("blocked_slots")
    .insert({ date, time: validatedTime, all_day: blockWholeDay })
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
