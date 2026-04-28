import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const eventId = Sentry.captureException(
    new Error("Launch monitoring verification event")
  );
  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
    eventId,
  });
}
