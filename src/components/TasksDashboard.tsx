"use client";

import { useMemo, useState } from "react";
import { RECURRENCE_VALUES, RECURRENCE_LABELS, todayDateString, type Recurrence } from "@/lib/tasks";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  category: string | null;
  due_date: string | null;
  recurrence: Recurrence;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  initialTasks: Task[];
}

const UNCATEGORIZED = "Uncategorized";

function dueStatus(dueDate: string | null, completed: boolean): {
  label: string;
  tone: "overdue" | "today" | "soon" | "future" | "none" | "done";
} {
  if (completed) return { label: "", tone: "done" };
  if (!dueDate) return { label: "No due date", tone: "none" };
  const today = todayDateString();
  if (dueDate < today) return { label: `Overdue · ${formatDate(dueDate)}`, tone: "overdue" };
  if (dueDate === today) return { label: "Due today", tone: "today" };
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  if (dueDate === tomorrowStr) return { label: "Due tomorrow", tone: "today" };
  return { label: `Due ${formatDate(dueDate)}`, tone: dueDate < addDaysToToday(7) ? "soon" : "future" };
}

function addDaysToToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function TasksDashboard({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    category: "",
    due_date: "",
    recurrence: "none" as Recurrence,
    notes: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [actError, setActError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; category: string; due_date: string; recurrence: Recurrence; notes: string }>({
    title: "", category: "", due_date: "", recurrence: "none", notes: "",
  });

  const { active, completed, categories } = useMemo(() => {
    const active: Task[] = [];
    const completed: Task[] = [];
    const categorySet = new Set<string>();
    for (const t of tasks) {
      if (t.category) categorySet.add(t.category);
      if (t.completed_at) completed.push(t);
      else active.push(t);
    }
    active.sort((a, b) => {
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      return b.created_at.localeCompare(a.created_at);
    });
    completed.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return { active, completed, categories: Array.from(categorySet).sort() };
  }, [tasks]);

  const activeByCategory = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of active) {
      const key = t.category ?? UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === UNCATEGORIZED) return 1;
      if (b[0] === UNCATEGORIZED) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [active]);

  const overdueCount = active.filter((t) => t.due_date && t.due_date < todayDateString()).length;
  const dueTodayCount = active.filter((t) => t.due_date === todayDateString()).length;

  async function createTask() {
    if (!draft.title.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          category: draft.category || undefined,
          due_date: draft.due_date || undefined,
          recurrence: draft.recurrence,
          notes: draft.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create task.");
        return;
      }
      setTasks((prev) => [data, ...prev]);
      setDraft({ title: "", category: "", due_date: "", recurrence: "none", notes: "" });
      setShowAddForm(false);
    } finally {
      setCreating(false);
    }
  }

  async function toggleComplete(task: Task) {
    setActingId(task.id);
    setActError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed_at }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActError(data.error ?? "Failed to update task.");
        return;
      }
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === task.id ? data.task : t));
        if (data.next) next.unshift(data.next);
        return next;
      });
    } finally {
      setActingId(null);
    }
  }

  async function deleteTask(id: string) {
    setActingId(id);
    setActError("");
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } else {
        setActError("Failed to delete task.");
      }
    } finally {
      setActingId(null);
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditDraft({
      title: task.title,
      category: task.category ?? "",
      due_date: task.due_date ?? "",
      recurrence: task.recurrence,
      notes: task.notes ?? "",
    });
  }

  async function saveEdit(id: string) {
    setActingId(id);
    setActError("");
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editDraft.title,
          category: editDraft.category,
          due_date: editDraft.due_date,
          recurrence: editDraft.recurrence,
          notes: editDraft.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActError(data.error ?? "Failed to save changes.");
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
      setEditingId(null);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="admin-wrap tasks-wrap">
      <div className="admin-header">
        <h1>Tasks</h1>
        <div className="tasks-counts">
          {overdueCount > 0 && <span className="tasks-pill overdue">{overdueCount} overdue</span>}
          {dueTodayCount > 0 && <span className="tasks-pill today">{dueTodayCount} due today</span>}
          <span className="admin-count">{active.length} open</span>
        </div>
      </div>

      {actError && <div className="modal-error">{actError}</div>}

      <div className="tasks-add-wrap">
        {!showAddForm ? (
          <button type="button" className="btn btn-primary tasks-add-btn" onClick={() => setShowAddForm(true)}>
            + Add task
          </button>
        ) : (
          <div className="tasks-form">
            <input
              className="modal-input"
              type="text"
              placeholder="What needs doing?"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              autoFocus
              maxLength={200}
            />
            <div className="tasks-form-row">
              <input
                className="modal-input"
                type="text"
                list="tasks-category-options"
                placeholder="Category (optional)"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                maxLength={50}
              />
              <input
                className="modal-input"
                type="date"
                value={draft.due_date}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                aria-label="Due date"
              />
              <select
                className="modal-select"
                value={draft.recurrence}
                onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as Recurrence })}
                aria-label="Repeat"
              >
                {RECURRENCE_VALUES.map((r) => (
                  <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <textarea
              className="modal-input tasks-notes"
              placeholder="Notes (optional)"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              maxLength={2000}
            />
            <datalist id="tasks-category-options">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            {createError && <div className="modal-error">{createError}</div>}
            <div className="tasks-form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowAddForm(false); setCreateError(""); }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!draft.title.trim() || creating || (draft.recurrence !== "none" && !draft.due_date)}
                onClick={createTask}
              >
                {creating ? "Saving…" : "Save task"}
              </button>
            </div>
          </div>
        )}
      </div>

      {active.length === 0 && completed.length === 0 ? (
        <div className="tasks-empty">
          <p>No tasks yet.</p>
          <p className="tasks-empty-sub">Add things like &ldquo;follow up with Rachel about Thursday payment&rdquo; or &ldquo;order new balls&rdquo;. Recurring tasks (weekly, monthly) will auto-regenerate when you check them off.</p>
        </div>
      ) : (
        <div className="tasks-list">
          {activeByCategory.map(([cat, list]) => (
            <div key={cat} className="tasks-category">
              <h3 className="tasks-category-title">{cat}</h3>
              {list.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  acting={actingId === task.id}
                  editing={editingId === task.id}
                  editDraft={editDraft}
                  setEditDraft={setEditDraft}
                  categories={categories}
                  onToggle={() => toggleComplete(task)}
                  onEdit={() => startEdit(task)}
                  onDelete={() => deleteTask(task.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={() => saveEdit(task.id)}
                />
              ))}
            </div>
          ))}

          {completed.length > 0 && (
            <div className="tasks-completed-section">
              <button
                type="button"
                className="tasks-completed-toggle"
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted}
              >
                {showCompleted ? "▼" : "▶"} {completed.length} completed
              </button>
              {showCompleted && (
                <div className="tasks-completed-list">
                  {completed.slice(0, 50).map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      acting={actingId === task.id}
                      editing={false}
                      editDraft={editDraft}
                      setEditDraft={setEditDraft}
                      categories={categories}
                      onToggle={() => toggleComplete(task)}
                      onEdit={() => startEdit(task)}
                      onDelete={() => deleteTask(task.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={() => saveEdit(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  acting: boolean;
  editing: boolean;
  editDraft: { title: string; category: string; due_date: string; recurrence: Recurrence; notes: string };
  setEditDraft: (d: { title: string; category: string; due_date: string; recurrence: Recurrence; notes: string }) => void;
  categories: string[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
}

function TaskRow({ task, acting, editing, editDraft, setEditDraft, categories, onToggle, onEdit, onDelete, onCancelEdit, onSave }: TaskRowProps) {
  const completed = !!task.completed_at;
  const status = dueStatus(task.due_date, completed);

  if (editing) {
    return (
      <div className="task-row task-row-editing">
        <input
          className="modal-input"
          type="text"
          value={editDraft.title}
          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
          maxLength={200}
        />
        <div className="tasks-form-row">
          <input
            className="modal-input"
            type="text"
            list="tasks-category-options-edit"
            placeholder="Category"
            value={editDraft.category}
            onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
            maxLength={50}
          />
          <input
            className="modal-input"
            type="date"
            value={editDraft.due_date}
            onChange={(e) => setEditDraft({ ...editDraft, due_date: e.target.value })}
          />
          <select
            className="modal-select"
            value={editDraft.recurrence}
            onChange={(e) => setEditDraft({ ...editDraft, recurrence: e.target.value as Recurrence })}
          >
            {RECURRENCE_VALUES.map((r) => (
              <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <textarea
          className="modal-input tasks-notes"
          placeholder="Notes"
          value={editDraft.notes}
          onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
          rows={2}
          maxLength={2000}
        />
        <datalist id="tasks-category-options-edit">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
        <div className="tasks-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={acting || !editDraft.title.trim()}>
            {acting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-row${completed ? " done" : ""}${status.tone === "overdue" ? " overdue" : ""}`}>
      <button
        type="button"
        className={`task-check${completed ? " checked" : ""}`}
        onClick={onToggle}
        disabled={acting}
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      >
        {completed && (
          <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 5 4.5 8.5 11 1" />
          </svg>
        )}
      </button>
      <div className="task-body">
        <div className="task-title">
          {task.title}
          {task.recurrence !== "none" && (
            <span className="task-recur" title={RECURRENCE_LABELS[task.recurrence]}>↻ {RECURRENCE_LABELS[task.recurrence]}</span>
          )}
        </div>
        {task.notes && <div className="task-notes">{task.notes}</div>}
        {!completed && status.label && (
          <div className={`task-due task-due-${status.tone}`}>{status.label}</div>
        )}
        {completed && task.completed_at && (
          <div className="task-due task-due-done">Completed {formatDate(task.completed_at.split("T")[0])}</div>
        )}
      </div>
      <div className="task-actions">
        <button type="button" className="admin-btn" onClick={onEdit} disabled={acting}>Edit</button>
        <button type="button" className="admin-btn cancel" onClick={onDelete} disabled={acting}>Delete</button>
      </div>
    </div>
  );
}
