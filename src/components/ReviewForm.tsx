"use client";

import { useState } from "react";

interface ReviewFormProps {
  /** Present on the emailed link. Absent on the public /review page. */
  token?: string;
  lessonLabel?: string;
  defaultName?: string;
}

export default function ReviewForm({ token, lessonLabel, defaultName }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [displayName, setDisplayName] = useState(defaultName ?? "");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const googleUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rating,
        body: text,
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

      <fieldset className="review-rating">
        <legend>How was it?</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            className={rating >= n ? "star on" : "star"}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </fieldset>

      <label>
        Anything you want to add? (optional)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={5}
        />
      </label>

      <label>
        How your name should appear
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          required
        />
      </label>

      {!token && (
        <label>
          Your email or phone (so DeMario knows who you are)
          <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={254} />
        </label>
      )}

      <label className="review-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        I am ok with DeMario publishing this on his website.
      </label>

      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px" }}
      />

      {error && <p className="review-error">{error}</p>}

      <button
        className="btn btn-primary"
        type="submit"
        disabled={state === "sending" || rating === 0 || !consent}
      >
        {state === "sending" ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
