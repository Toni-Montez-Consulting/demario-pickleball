import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { RECURRENCE_VALUES, isValidDateString, advanceDueDate, todayDateString, type Recurrence } from "@/lib/tasks";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await admin.supabase
    .from("admin_tasks")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: Record<string, string | null> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 200) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }
    update.title = body.title.trim();
  }
  if (body.notes !== undefined) {
    update.notes = typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 2000)
      : null;
  }
  if (body.category !== undefined) {
    update.category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim().slice(0, 50)
      : null;
  }
  if (body.due_date !== undefined) {
    if (body.due_date === null || body.due_date === "") {
      update.due_date = null;
    } else if (typeof body.due_date === "string" && isValidDateString(body.due_date)) {
      update.due_date = body.due_date;
    } else {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
  }
  if (body.recurrence !== undefined) {
    if (!RECURRENCE_VALUES.includes(body.recurrence)) {
      return NextResponse.json({ error: "Invalid recurrence" }, { status: 400 });
    }
    update.recurrence = body.recurrence;
  }
  if (body.priority !== undefined) {
    update.priority = body.priority === "high" ? "high" : "normal";
  }

  let spawnNextInstance = false;
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      return NextResponse.json({ error: "Invalid completed value" }, { status: 400 });
    }
    if (body.completed && !existing.completed_at) {
      update.completed_at = new Date().toISOString();
      if (existing.recurrence && existing.recurrence !== "none") {
        spawnNextInstance = true;
      }
    } else if (!body.completed) {
      update.completed_at = null;
    }
  }

  const { data, error } = await admin.supabase
    .from("admin_tasks")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[tasks PATCH]", error);
    return NextResponse.json({ error: "Failed to update task." }, { status: 500 });
  }

  let nextInstance = null;
  if (spawnNextInstance) {
    const baseDate = existing.due_date ?? todayDateString();
    const nextDate = advanceDueDate(baseDate, existing.recurrence as Recurrence);
    if (nextDate) {
      const { data: spawned, error: spawnError } = await admin.supabase
        .from("admin_tasks")
        .insert({
          title: existing.title,
          notes: existing.notes,
          category: existing.category,
          due_date: nextDate,
          recurrence: existing.recurrence,
          priority: existing.priority ?? "normal",
        })
        .select()
        .single();
      if (spawnError) {
        console.error("[tasks PATCH spawn]", spawnError);
      } else {
        nextInstance = spawned;
      }
    }
  }

  return NextResponse.json({ task: data, next: nextInstance });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error } = await admin.supabase.from("admin_tasks").delete().eq("id", id).select().single();
  if (error?.code === "PGRST116") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error) {
    console.error("[tasks DELETE]", error);
    return NextResponse.json({ error: "Failed to delete task." }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
