import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, email, message, company } = body;
  if (typeof company === "string" && company.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const rateLimit = await checkRateLimit(supabase, req, {
    route: "inquiries",
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

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
