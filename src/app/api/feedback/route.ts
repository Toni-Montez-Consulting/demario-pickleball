import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { sendFeedbackEmail } from "@/lib/email/client";

const VALID_TYPES = ["Bug", "Feature Request", "Question"] as const;
type FeedbackType = (typeof VALID_TYPES)[number];

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const type: FeedbackType = VALID_TYPES.includes(body.type) ? body.type : null!;
  if (!type) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) {
    return NextResponse.json({ error: "Title is required (max 200 chars)." }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  if (!description) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }

  // requireAdmin already read the signed-in user. Its client is the service
  // role, which has no session, so asking it for the user always said "unknown".
  const submitter = admin.user.email ?? "unknown";

  const { data, error } = await admin.supabase
    .from("admin_tasks")
    .insert({
      title,
      notes: description,
      category: `Feedback: ${type}`,
      recurrence: "none",
      priority: "high",
    })
    .select()
    .single();

  if (error) {
    console.error("[feedback POST]", error);
    return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });
  }

  // Email failure is non-fatal — task was already created. after() keeps the
  // function alive until the send finishes.
  after(() =>
    sendFeedbackEmail({ type, title, description, submitter }).catch((err) =>
      console.error("[feedback email]", err)
    )
  );

  return NextResponse.json(data, { status: 201 });
}
