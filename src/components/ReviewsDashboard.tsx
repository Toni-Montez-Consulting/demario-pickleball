"use client";

import { useMemo, useState } from "react";

interface Review {
  id: string;
  rating: number;
  body: string | null;
  display_name: string;
  lesson_context: string | null;
  tag: string | null;
  takeaway: string | null;
  verified_booking: boolean;
  source: string;
  status: "pending" | "published" | "hidden";
  created_at: string;
  published_at: string | null;
}

interface Props {
  initialReviews: Review[];
}

const FILTERS = ["pending", "published", "hidden"] as const;
type Filter = (typeof FILTERS)[number];

async function responseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReviewsDashboard({ initialReviews }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ tag: "", takeaway: "" });

  const counts = useMemo(() => {
    const out: Record<Filter, number> = { pending: 0, published: 0, hidden: 0 };
    for (const r of reviews) out[r.status]++;
    return out;
  }, [reviews]);

  const visible = useMemo(
    () => reviews.filter((r) => r.status === filter),
    [reviews, filter]
  );

  async function patch(id: string, payload: Record<string, unknown>, fallback: string) {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res || !res.ok) {
      setError(res ? await responseError(res, fallback) : fallback);
      setBusy(null);
      return;
    }
    const updated: Review = await res.json();
    setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    setBusy(null);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;
    setBusy(id);
    setError("");
    const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setError(res ? await responseError(res, "Could not delete that review.") : "Could not delete that review.");
      setBusy(null);
      return;
    }
    setReviews((prev) => prev.filter((r) => r.id !== id));
    setBusy(null);
  }

  function startEditing(r: Review) {
    setEditing(r.id);
    setDraft({ tag: r.tag ?? "", takeaway: r.takeaway ?? "" });
  }

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h1>Reviews</h1>
        <p className="admin-nav-desc">
          Nothing appears on the website until you publish it. You can hide or delete a
          review, but you cannot change what a student wrote.
        </p>
      </div>

      <div className="admin-tabs">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`admin-tab${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
            <span className="admin-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {error && <p className="review-error">{error}</p>}

      {visible.length === 0 ? (
        <p className="admin-empty">
          {filter === "pending"
            ? "Nothing waiting. New reviews show up here after a student submits one."
            : `No ${filter} reviews.`}
        </p>
      ) : (
        <div className="review-queue">
          {visible.map((r) => (
            <article className="review-row" key={r.id}>
              <header className="review-row-head">
                <span className="review-stars" aria-label={`${r.rating} out of 5`}>
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>
                <span className={r.verified_booking ? "review-badge verified" : "review-badge"}>
                  {r.verified_booking ? "Verified booking" : "Unverified"}
                </span>
                <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
              </header>

              {r.body && <p className="review-body">{r.body}</p>}

              <p className="review-meta">
                {r.display_name}
                {r.lesson_context ? ` · ${r.lesson_context}` : ""}
              </p>

              {editing === r.id ? (
                <div className="review-labels">
                  <label>
                    Tag
                    <input
                      value={draft.tag}
                      maxLength={120}
                      placeholder="Strategy"
                      onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                    />
                  </label>
                  <label>
                    Lesson impact (fills the featured slot)
                    <input
                      value={draft.takeaway}
                      maxLength={120}
                      placeholder="Better point construction"
                      onChange={(e) => setDraft({ ...draft, takeaway: e.target.value })}
                    />
                  </label>
                  <div className="review-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={busy === r.id}
                      onClick={() => patch(r.id, draft, "Could not save those labels.")}
                    >
                      Save labels
                    </button>
                    <button type="button" className="admin-btn" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                (r.tag || r.takeaway) && (
                  <p className="review-labels-summary">
                    {r.tag && <span className="review-tag">{r.tag}</span>}
                    {r.takeaway && <span>Featured: {r.takeaway}</span>}
                  </p>
                )
              )}

              <div className="review-actions">
                {r.status !== "published" && (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy === r.id}
                    onClick={() => patch(r.id, { status: "published" }, "Could not publish that review.")}
                  >
                    Publish
                  </button>
                )}
                {r.status !== "hidden" && (
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy === r.id}
                    onClick={() => patch(r.id, { status: "hidden" }, "Could not hide that review.")}
                  >
                    Hide
                  </button>
                )}
                {editing !== r.id && (
                  <button type="button" className="admin-btn" onClick={() => startEditing(r)}>
                    Labels
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn danger"
                  disabled={busy === r.id}
                  onClick={() => remove(r.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
