import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailabilityForDate, isValidDateString } from "@/lib/availability";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const supabase = anonClient();
  const { data, error } = await getAvailabilityForDate(supabase, date);
  if (error || !data) {
    console.error("[availability GET]", error);
    return NextResponse.json({ error: "Failed to load availability." }, { status: 500 });
  }

  return NextResponse.json({
    allDay: data.allDay,
    unavailable: data.unavailable,
    booked: data.unavailable,
  });
}
