"use client";

import { useEffect, useState } from "react";

interface ReviewFormProps {
  /** Present on the emailed link. Absent on the public /review page. */
  token?: string;
  lessonLabel?: string;
  defaultName?: string;
}

export default function ReviewForm({ token, lessonLabel, defaultName }: ReviewFormProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Until the client has hydrated, submitting would trigger a plain form GET
  // and silently reload the page. Say so with the button rather than let a tap
  // vanish. The rating radios above work without JS either way.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const googleUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL;

  /**
   * Values are read from the form itself, not from React state, so a tap that
   * lands before hydration is never lost. Rating is a native radio group and
   * the star fill is pure CSS for the same reason.
   */
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const rating = Number(form.get("rating") ?? 0);
    const consent = form.get("consent") === "on";
    const body = String(form.get("body") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();
    const contact = String(form.get("contact") ?? "");
    const company = String(form.get("company") ?? "");

    if (rating === 0) {
      setError("Pick a star rating first.");
      setState("error");
      return;
    }
    if (!displayName) {
      setError("Add the name you want shown with your review.");
      setState("error");
      return;
    }
    if (!consent) {
      setError("Check the box so DeMario knows he can publish this.");
      setState("error");
      return;
    }

    setState("sending");
    setError("");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rating,
        body,
        displayName,
        contact: token ? undefined : contact,
        consent,
        company,
      }),
    }).catch(() => null);

    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      setError(data.error ?? "Something went wrong. Please try again.");
      setState("error");
      return;
    }
    setText(body);
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="review-done">
        <h2>Thank you.</h2>
        <p>
          Your review is with DeMario for approval. It will appear on the site once he
          publishes it.
        </p>
        {googleUrl && text.trim() && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(text);
              window.open(googleUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Post this to Google too
          </button>
        )}
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={submit}>
      {lessonLabel && <p className="review-lesson">Reviewing: {lessonLabel}</p>}

      {/* Rendered high-to-low so the CSS sibling selector can fill every star
          below the checked one. Visually reversed with row-reverse. */}
      <fieldset className="review-rating">
        <legend>How was it?</legend>
        {[5, 4, 3, 2, 1].map((n) => (
          <span className="star-option" key={n}>
            <input
              type="radio"
              id={`rating-${n}`}
              name="rating"
              value={n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            />
            <label htmlFor={`rating-${n}`} aria-hidden="true">
              ★
            </label>
          </span>
        ))}
      </fieldset>

      <label>
        Anything you want to add? (optional)
        <textarea name="body" defaultValue="" maxLength={2000} rows={5} />
      </label>

      <label>
        How your name should appear
        <input name="displayName" defaultValue={defaultName ?? ""} maxLength={80} />
      </label>

      {!token && (
        <label>
          Your email or phone (so DeMario knows who you are)
          <input name="contact" defaultValue="" maxLength={254} />
        </label>
      )}

      <label className="review-consent">
        <input type="checkbox" name="consent" />
        I am ok with DeMario publishing this on his website.
      </label>

      <input
        type="text"
        name="company"
        defaultValue=""
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px" }}
      />

      {error && (
        <p className="review-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-primary" type="submit" disabled={!ready || state === "sending"}>
        {state === "sending" ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
