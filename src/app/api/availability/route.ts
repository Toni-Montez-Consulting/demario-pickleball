import { NextRequest, NextResponse } from "next/server";
import { getAvailabilityForDate, isValidDateString } from "@/lib/availability";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidDateString(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
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
