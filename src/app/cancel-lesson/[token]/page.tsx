import type { Metadata } from "next";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { outcomeSecret } from "@/lib/lesson-outcomes";
import { cancelView, verifyCancelToken, type CancelBooking } from "@/lib/lesson-cancel";

export const metadata: Metadata = {
  title: "Cancel lesson · DeMario Montez Pickleball",
  robots: { index: false, follow: false },
};

/**
 * Where "Cancel this lesson" in DeMario's emails lands. Rendering it changes
 * nothing: mail scanners fetch every link in an email, so only the button
 * below (a form POST) acts.
 * Design: docs/specs/2026-10-23-one-tap-cancel.md
 */
export default async function CancelLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ failed?: string | string[] }>;
}) {
  const { token: raw } = await params;
  const { failed: failedParam } = await searchParams;
  const failed = failedParam === "save" || failedParam === "busy" ? failedParam : null;
  // A malformed %-sequence must render "isn't valid", not a server error.
  let token = raw;
  try {
    token = decodeURIComponent(raw);
  } catch {
    // Keep the raw value; verification will reject it.
  }
  const secret = outcomeSecret();
  const check = secret ? verifyCancelToken(token, secret) : null;

  let booking: CancelBooking | null = null;
  let loadFailed = false;
  if (check?.ok) {
    const { data, error } = await createServiceRoleClient()
      .from("bookings")
      .select("name,status,lesson_type,lesson_date,lesson_time")
      .eq("id", check.bookingId)
      .maybeSingle();
    if (error) {
      console.error("[cancel-lesson page] booking lookup failed", check.bookingId, error);
      loadFailed = true;
    }
    booking = data;
  }

  const view = cancelView({ configured: Boolean(secret), check, booking, loadFailed, failed });

  return (
    <main className="outcome-page">
      <p className="kicker">Lesson</p>
      <h1>{view.heading}</h1>
      {view.state === "ready" ? (
        <>
          {view.alert && (
            <p className="outcome-alert" role="alert">
              {view.alert}
            </p>
          )}
          <dl className="outcome-facts">
            <div>
              <dt>Student</dt>
              <dd>{view.lesson.student}</dd>
            </div>
            <div>
              <dt>Lesson</dt>
              <dd>{view.lesson.name}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{view.lesson.when}</dd>
            </div>
          </dl>
          <form method="post" action="/api/cancel-lesson">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary btn-full">
              Cancel the lesson
            </button>
          </form>
          <p className="outcome-note">{view.note}</p>
        </>
      ) : (
        <p className="outcome-note">{view.body}</p>
      )}
      <Link className="btn btn-ghost btn-full" href="/admin">
        {view.state === "ready" ? "Open Admin instead" : "Open Admin"}
      </Link>
    </main>
  );
}
