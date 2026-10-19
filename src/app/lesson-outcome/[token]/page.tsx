import type { Metadata } from "next";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  outcomeSecret,
  outcomeView,
  verifyOutcomeToken,
  type OutcomeBooking,
} from "@/lib/lesson-outcomes";

export const metadata: Metadata = {
  title: "Lesson outcome · DeMario Montez Pickleball",
  robots: { index: false, follow: false },
};

/**
 * Where a button in Mario's morning digest lands. Rendering it changes
 * nothing: mail scanners fetch every link in an email, so only the button
 * below (a form POST) records an outcome.
 * Design: docs/specs/2026-10-19-lesson-outcome-nudge.md
 */
export default async function LessonOutcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ failed?: string | string[] }>;
}) {
  const { token: raw } = await params;
  // Set by the endpoint when a tap did not save.
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
  const check = secret ? verifyOutcomeToken(token, secret) : null;

  let booking: OutcomeBooking | null = null;
  let loadFailed = false;
  if (check?.ok) {
    const { data, error } = await createServiceRoleClient()
      .from("bookings")
      .select("name,lesson_type,lesson_date,lesson_time,status,student_id")
      .eq("id", check.bookingId)
      .maybeSingle();
    if (error) {
      console.error("[lesson-outcome page] booking lookup failed", check.bookingId, error);
      loadFailed = true;
    }
    booking = data;
  }

  const view = outcomeView({ configured: Boolean(secret), check, booking, loadFailed, failed });

  return (
    <main className="outcome-page">
      <p className="kicker">Lesson outcome</p>
      <h1>{view.heading}</h1>
      {view.state === "pending" ? (
        <>
          {view.alert && (
            <p className="outcome-alert" role="alert">
              {view.alert}
            </p>
          )}
          <dl className="outcome-facts">
            {view.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <form method="post" action="/api/lesson-outcome">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary btn-full">
              {view.button}
            </button>
          </form>
          <p className="outcome-note">{view.note}</p>
        </>
      ) : (
        <p className="outcome-note">{view.body}</p>
      )}
      <Link className="btn btn-ghost btn-full" href="/admin">
        {view.state === "pending" ? "Open Admin instead" : "Open Admin"}
      </Link>
    </main>
  );
}
