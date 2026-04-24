import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, isAdminEmail } from "@/lib/supabase/server";
import { RECURRENCE_VALUES, isValidDateString, type Recurrence } from "@/lib/tasks";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("admin_tasks")
    .select("*")
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[tasks GET]", error);
    return NextResponse.json({ error: "Failed to load tasks." }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) {
    return NextResponse.json({ error: "Title is required (max 200 chars)." }, { status: 400 });
  }

  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || null : null;
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 50) || null : null;

  let due_date: string | null = null;
  if (body.due_date) {
    if (typeof body.due_date !== "string" || !isValidDateString(body.due_date)) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
    due_date = body.due_date;
  }

  const recurrence: Recurrence = RECURRENCE_VALUES.includes(body.recurrence) ? body.recurrence : "none";
  if (recurrence !== "none" && !due_date) {
    return NextResponse.json({ error: "Recurring tasks need a due date." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("admin_tasks")
    .insert({ title, notes, category, due_date, recurrence })
    .select()
    .single();

  if (error) {
    console.error("[tasks POST]", error);
    return NextResponse.json({ error: "Failed to create task." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
