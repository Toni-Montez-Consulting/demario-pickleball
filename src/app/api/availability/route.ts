import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dayOfWeek = parsedDate.getUTCDay();

  const supabase = anonClient();

  const [bookingsResult, blockedResult, recurringResult] = await Promise.all([
    supabase
      .from("bookings")
      .select("lesson_time")
      .eq("lesson_date", date)
      .neq("status", "cancelled"),
    supabase
      .from("blocked_slots")
      .select("time, all_day")
      .eq("date", date),
    supabase
      .from("recurring_blocks")
      .select("time")
      .eq("day_of_week", dayOfWeek),
  ]);

  let allDay = false;
  const unavailable = new Set<string>();

  bookingsResult.data?.forEach((b) => b.lesson_time && unavailable.add(b.lesson_time));
  blockedResult.data?.forEach((b) => {
    if (b.all_day) allDay = true;
    else if (b.time) unavailable.add(b.time);
  });
  recurringResult.data?.forEach((b) => {
    if (b.time === null) allDay = true;
    else unavailable.add(b.time);
  });

  return NextResponse.json({
    allDay,
    unavailable: Array.from(unavailable),
    booked: Array.from(unavailable),
  });
}
