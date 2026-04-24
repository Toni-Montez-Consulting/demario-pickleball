import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, email, message } = body;
  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim() || name.length > 120) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("inquiries")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("[inquiries POST]", error);
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
