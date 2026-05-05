"use client";

import { useEffect, useRef, useState } from "react";

type FeedbackType = "Bug" | "Feature Request" | "Question";
const TYPES: FeedbackType[] = ["Bug", "Feature Request", "Question"];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ open, onClose }: Props) {
  const [type, setType] = useState<FeedbackType>("Bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit. Please try again.");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setTitle("");
        setDescription("");
        setType("Bug");
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Report an issue">
        <div className="modal-header">
          <h2 className="modal-title">Report an issue</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {success ? (
          <div className="feedback-success">
            <p>Got it — Toni will see this.</p>
          </div>
        ) : (
          <div className="feedback-body">
            <div className="feedback-type-row">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`feedback-type-btn${type === t ? " active" : ""}`}
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="feedback-label" htmlFor="feedback-title">What&apos;s the issue?</label>
            <input
              id="feedback-title"
              ref={titleRef}
              className="modal-input"
              type="text"
              placeholder="Brief summary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />

            <label className="feedback-label" htmlFor="feedback-desc">Details</label>
            <textarea
              id="feedback-desc"
              className="modal-input feedback-textarea"
              placeholder="What happened? What did you expect?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
            />

            {error && <div className="modal-error">{error}</div>}

            <div className="feedback-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!title.trim() || !description.trim() || submitting}
                onClick={submit}
              >
                {submitting ? "Sending…" : "Send to Toni"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
