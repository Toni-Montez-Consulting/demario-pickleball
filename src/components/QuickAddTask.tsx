"use client";

import { useState } from "react";

interface Props {
  category: string;
  hint?: string;
}

export default function QuickAddTask({ category, hint }: Props) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category }),
      });
      if (res.ok) {
        setTitle("");
        setError("");
        setSaved(true);
        setTimeout(() => setSaved(false), 3500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Couldn't add task. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="quick-add-task">
      <p className="quick-add-label">
        {hint ?? "Need to add something to the to-do list? Type it here and it will show up in Tasks."}
      </p>
      <div className="quick-add-row">
        <input
          className="modal-input quick-add-input"
          type="text"
          placeholder="e.g. Call the insurance company"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleAdd(); }}
          maxLength={200}
          disabled={saving}
          aria-label="New task title"
        />
        <button
          type="button"
          className="btn btn-primary quick-add-btn"
          disabled={!title.trim() || saving}
          onClick={handleAdd}
        >
          {saving ? "Adding…" : "Add to Tasks"}
        </button>
      </div>
      {saved && <p className="quick-add-success">✓ Added! Go to Tasks to set a due date or priority.</p>}
      {error && <p className="quick-add-error">{error}</p>}
    </div>
  );
}
