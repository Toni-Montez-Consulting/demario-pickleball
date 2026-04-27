"use client";

import { useState, useEffect, useRef } from "react";

interface Booking {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  lesson_type: string;
  lesson_date: string;
  lesson_time: string;
  status: "pending" | "confirmed" | "cancelled";
  notes: string | null;
  paid_at: string | null;
}

interface Inquiry {
  id: string;
  created_at: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
}

interface BlockedSlot {
  id: string;
  date: string;
  time: string | null;
  all_day: boolean;
  created_at: string;
}

interface TimeSlot {
  id: string;
  display_label: string;
  sort_key: number;
  active: boolean;
}

interface RecurringBlock {
  id: string;
  day_of_week: number;
  time: string | null;
  created_at: string;
}

interface CalendarSyncStatus {
  enabled: boolean;
  configured: boolean;
  calendarId: string | null;
  checkedDate: string;
  ok: boolean;
  busyCount: number;
  error: string | null;
}

interface Props {
  initialBookings: Booking[];
  initialInquiries: Inquiry[];
}

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function responseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

export default function AdminDashboard({ initialBookings, initialInquiries }: Props) {
  const [tab, setTab] = useState<"bookings" | "inquiries" | "availability">("bookings");
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  // Availability state
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [recurringBlocks, setRecurringBlocks] = useState<RecurringBlock[]>([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [slotError, setSlotError] = useState("");
  const [slotLoading, setSlotLoading] = useState(false);
  const [recurringDay, setRecurringDay] = useState(1);
  const [recurringTime, setRecurringTime] = useState("");
  const [recurringError, setRecurringError] = useState("");
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);
  const [availFetchError, setAvailFetchError] = useState("");
  const [calendarSync, setCalendarSync] = useState<CalendarSyncStatus | null>(null);
  const hasLoadedAvailRef = useRef(false);

  const activeTimeSlots = timeSlots.filter((s) => s.active);

  const unread = inquiries.filter((i) => !i.read).length;

  useEffect(() => {
    if (tab !== "availability" || hasLoadedAvailRef.current) return;
    setAvailLoading(true);
    setAvailFetchError("");
    Promise.all([
      fetch("/api/blocked-slots").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/time-slots?all=true").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/recurring-blocks").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/calendar-sync").then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([blocked, slots, recurring, sync]) => {
        setBlockedSlots(Array.isArray(blocked) ? blocked : []);
        setTimeSlots(Array.isArray(slots) ? slots : []);
        setRecurringBlocks(Array.isArray(recurring) ? recurring : []);
        setCalendarSync(sync && typeof sync === "object" ? sync : null);
        const firstActive = Array.isArray(slots) ? (slots as TimeSlot[]).find((s) => s.active) : null;
        if (firstActive) {
          setBlockTime((prev) => prev || firstActive.display_label);
          setRecurringTime((prev) => prev || firstActive.display_label);
        }
        hasLoadedAvailRef.current = true;
      })
      .catch(() => setAvailFetchError("Failed to load availability. Please refresh the page."))
      .finally(() => setAvailLoading(false));
  }, [tab]);

  async function updateBookingStatus(id: string, status: "confirmed" | "cancelled") {
    if (status === "cancelled" && !window.confirm("Cancel this booking and email the student?")) {
      return;
    }
    setUpdating(id);
    setUpdateError("");
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: updated.status } : b)));
      } else {
        setUpdateError(await responseError(res, "Failed to update booking. Please try again."));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function togglePaid(b: Booking) {
    setUpdating(b.id);
    setUpdateError("");
    try {
      const res = await fetch(`/api/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !b.paid_at }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBookings((prev) => prev.map((x) => (x.id === b.id ? { ...x, paid_at: updated.paid_at } : x)));
      } else {
        setUpdateError(await responseError(res, "Failed to update payment status. Please try again."));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function toggleRead(inq: Inquiry) {
    setUpdating(inq.id);
    try {
      const res = await fetch(`/api/inquiries/${inq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: !inq.read }),
      });
      if (res.ok) {
        setInquiries((prev) => prev.map((i) => (i.id === inq.id ? { ...i, read: !i.read } : i)));
      } else {
        setUpdateError(await responseError(res, "Failed to update inquiry."));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function blockSlot() {
    if (!blockDate) return;
    if (!blockAllDay && !blockTime) return;
    setBlockLoading(true);
    setBlockError("");
    try {
      const payload = blockAllDay
        ? { date: blockDate, all_day: true }
        : { date: blockDate, time: blockTime };
      const res = await fetch("/api/blocked-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBlockError(data.error ?? "Failed to block slot.");
        return;
      }
      setBlockedSlots((prev) =>
        [...prev, data].sort(
          (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")
        )
      );
      setBlockDate("");
      setBlockAllDay(false);
    } finally {
      setBlockLoading(false);
    }
  }

  async function unblockSlot(id: string) {
    if (!window.confirm("Unblock this date or time?")) return;
    setUpdating(id);
    setBlockError("");
    try {
      const res = await fetch(`/api/blocked-slots/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBlockedSlots((prev) => prev.filter((s) => s.id !== id));
      } else {
        setBlockError(await responseError(res, "Failed to unblock slot."));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function addTimeSlot() {
    if (!newSlotLabel.trim()) return;
    setSlotLoading(true);
    setSlotError("");
    try {
      const res = await fetch("/api/time-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_label: newSlotLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSlotError(data.error ?? "Failed to add time slot.");
        return;
      }
      setTimeSlots((prev) => [...prev, data].sort((a, b) => a.sort_key - b.sort_key));
      setNewSlotLabel("");
    } finally {
      setSlotLoading(false);
    }
  }

  async function toggleSlotActive(slot: TimeSlot) {
    setUpdating(slot.id);
    setSlotError("");
    try {
      const res = await fetch(`/api/time-slots/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !slot.active }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTimeSlots((prev) => prev.map((s) => (s.id === slot.id ? updated : s)));
      } else {
        setSlotError(await responseError(res, "Failed to update time slot."));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function deleteTimeSlot(id: string) {
    if (!window.confirm("Delete this time slot? Existing bookings will not be deleted.")) return;
    setUpdating(id);
    setSlotError("");
    try {
      const res = await fetch(`/api/time-slots/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTimeSlots((prev) => prev.filter((s) => s.id !== id));
      } else {
        setSlotError(await responseError(res, "Failed to delete time slot."));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function addRecurringBlock(allDay: boolean) {
    setRecurringLoading(true);
    setRecurringError("");
    try {
      const payload = allDay
        ? { day_of_week: recurringDay, time: null }
        : { day_of_week: recurringDay, time: recurringTime };
      const res = await fetch("/api/recurring-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecurringError(data.error ?? "Failed to add recurring block.");
        return;
      }
      setRecurringBlocks((prev) =>
        [...prev, data].sort((a, b) => a.day_of_week - b.day_of_week || (a.time ?? "").localeCompare(b.time ?? ""))
      );
    } finally {
      setRecurringLoading(false);
    }
  }

  async function deleteRecurring(id: string) {
    if (!window.confirm("Delete this recurring unavailability rule?")) return;
    setUpdating(id);
    setRecurringError("");
    try {
      const res = await fetch(`/api/recurring-blocks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecurringBlocks((prev) => prev.filter((r) => r.id !== id));
      } else {
        setRecurringError(await responseError(res, "Failed to delete recurring block."));
      }
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="admin-wrap">
      <div className="admin-header">
        <h1>Dashboard</h1>
        <span className="admin-count">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="admin-tabs">
        <button type="button" className={`admin-tab${tab === "bookings" ? " active" : ""}`} onClick={() => setTab("bookings")}>
          Bookings
        </button>
        <button type="button" className={`admin-tab${tab === "inquiries" ? " active" : ""}`} onClick={() => setTab("inquiries")}>
          Inquiries
          {unread > 0 && <span className="unread-dot" />}
        </button>
        <button type="button" className={`admin-tab${tab === "availability" ? " active" : ""}`} onClick={() => setTab("availability")}>
          Availability
        </button>
      </div>

      {tab !== "bookings" && updateError && <div className="modal-error">{updateError}</div>}

      {tab === "bookings" && (
        <>
          {updateError && <div className="modal-error">{updateError}</div>}
          <div className="admin-table-scroll">
            {bookings.length === 0 ? (
              <p className="admin-empty">No bookings yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Student</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Paid</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.lesson_date}</td>
                      <td>{b.lesson_time}</td>
                      <td>
                        <div className="td-name">{b.name}</div>
                        <div className="td-email-sub">{b.email}</div>
                      </td>
                      <td>{LESSON_NAMES[b.lesson_type] ?? b.lesson_type}</td>
                      <td>
                        <span className={`status-badge status-${b.status}`}>{b.status}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`paid-toggle${b.paid_at ? " paid" : ""}`}
                          disabled={updating === b.id}
                          onClick={() => togglePaid(b)}
                          aria-label={b.paid_at ? "Mark as unpaid" : "Mark as paid"}
                          title={b.paid_at ? `Paid ${new Date(b.paid_at).toLocaleDateString()}` : "Mark paid"}
                        >
                          {b.paid_at ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span className="paid-toggle-label">Mark paid</span>
                          )}
                        </button>
                      </td>
                      <td>
                        <div className="td-actions">
                          <button
                            type="button"
                            className="admin-btn confirm"
                            disabled={b.status === "confirmed" || updating === b.id}
                            onClick={() => updateBookingStatus(b.id, "confirmed")}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            className="admin-btn cancel"
                            disabled={b.status === "cancelled" || updating === b.id}
                            onClick={() => updateBookingStatus(b.id, "cancelled")}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "inquiries" && (
        <div>
          {inquiries.length === 0 ? (
            <p className="admin-empty">No inquiries yet.</p>
          ) : (
            inquiries.map((inq) => (
              <div key={inq.id} className={`inquiry-card${inq.read ? " inquiry-read" : ""}`}>
                <div className="inq-header">
                  <div className="inq-name">
                    {inq.name}
                    {!inq.read && <span className="unread-dot" />}
                  </div>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={updating === inq.id}
                    onClick={() => toggleRead(inq)}
                  >
                    {inq.read ? "Mark unread" : "Mark read"}
                  </button>
                </div>
                <div className="inq-email">{inq.email}</div>
                <div className="inq-msg">{inq.message}</div>
                <div className="inq-date">{new Date(inq.created_at).toLocaleDateString()}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "availability" && (
        <div className="avail-admin">
          {availFetchError && <div className="modal-error">{availFetchError}</div>}

          <section className="avail-section">
            <h2 className="avail-section-title">Google Calendar sync</h2>
            <p className="avail-section-sub">
              Checks DeMario&apos;s Google Calendar busy times before students can book.
            </p>
            {availLoading && !calendarSync ? (
              <p className="admin-empty">Checking Google Calendar…</p>
            ) : calendarSync ? (
              <div className="avail-row">
                <span className="avail-date">
                  {calendarSync.enabled
                    ? calendarSync.configured
                      ? calendarSync.ok
                        ? "Connected"
                        : "Needs attention"
                      : "Missing OAuth values"
                    : "Disabled"}
                </span>
                <span className={`status-badge ${calendarSync.ok ? "status-confirmed" : "status-pending"}`}>
                  {calendarSync.ok ? `${calendarSync.busyCount} busy blocks` : "not verified"}
                </span>
                <span className="avail-time">{calendarSync.checkedDate}</span>
                {calendarSync.error && <span className="avail-time">{calendarSync.error}</span>}
              </div>
            ) : (
              <p className="admin-empty">Google Calendar sync status unavailable.</p>
            )}
          </section>

          <section className="avail-section">
            <h2 className="avail-section-title">Time slots</h2>
            <p className="avail-section-sub">The times students can book on the site.</p>
            <div className="avail-form">
              <input
                className="modal-input avail-slot-input"
                type="text"
                placeholder="e.g. 10:00 AM"
                value={newSlotLabel}
                onChange={(e) => setNewSlotLabel(e.target.value)}
                aria-label="New time slot"
              />
              <button
                type="button"
                className="admin-btn avail-block-btn"
                disabled={!newSlotLabel.trim() || slotLoading}
                onClick={addTimeSlot}
              >
                {slotLoading ? "Adding…" : "Add slot"}
              </button>
            </div>
            {slotError && <div className="modal-error avail-error">{slotError}</div>}
            <div className="avail-list">
              {availLoading ? (
                <p className="admin-empty">Loading…</p>
              ) : timeSlots.length === 0 ? (
                <p className="admin-empty">No time slots yet. Add one above.</p>
              ) : (
                timeSlots.map((slot) => (
                  <div key={slot.id} className="avail-row">
                    <span className="avail-time">{slot.display_label}</span>
                    <span className={`status-badge ${slot.active ? "status-confirmed" : "status-cancelled"}`}>
                      {slot.active ? "active" : "hidden"}
                    </span>
                    <div className="td-actions">
                      <button
                        type="button"
                        className="admin-btn"
                        disabled={updating === slot.id}
                        onClick={() => toggleSlotActive(slot)}
                      >
                        {slot.active ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        className="admin-btn cancel"
                        disabled={updating === slot.id}
                        onClick={() => deleteTimeSlot(slot.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="avail-section">
            <h2 className="avail-section-title">Recurring unavailability</h2>
            <p className="avail-section-sub">Block a day of the week every week (e.g. no lessons on Tuesdays).</p>
            <div className="avail-form">
              <select
                className="modal-select avail-time-select"
                value={recurringDay}
                onChange={(e) => setRecurringDay(parseInt(e.target.value, 10))}
                aria-label="Day of week"
              >
                {DAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              <select
                className="modal-select avail-time-select"
                value={recurringTime}
                onChange={(e) => setRecurringTime(e.target.value)}
                aria-label="Time"
                disabled={activeTimeSlots.length === 0}
              >
                {activeTimeSlots.map((s) => (
                  <option key={s.id} value={s.display_label}>{s.display_label}</option>
                ))}
              </select>
              <button
                type="button"
                className="admin-btn avail-block-btn"
                disabled={!recurringTime || recurringLoading}
                onClick={() => addRecurringBlock(false)}
              >
                Block this time
              </button>
              <button
                type="button"
                className="admin-btn avail-block-btn"
                disabled={recurringLoading}
                onClick={() => addRecurringBlock(true)}
              >
                Block whole day
              </button>
            </div>
            {recurringError && <div className="modal-error avail-error">{recurringError}</div>}
            <div className="avail-list">
              {availLoading ? null : recurringBlocks.length === 0 ? (
                <p className="admin-empty">No recurring blocks.</p>
              ) : (
                recurringBlocks.map((r) => (
                  <div key={r.id} className="avail-row">
                    <span className="avail-date">Every {DAY_NAMES[r.day_of_week]}</span>
                    <span className="avail-time">{r.time ?? "All day"}</span>
                    <button
                      type="button"
                      className="admin-btn cancel"
                      disabled={updating === r.id}
                      onClick={() => deleteRecurring(r.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="avail-section">
            <h2 className="avail-section-title">One-off blocks</h2>
            <p className="avail-section-sub">Block a specific date — a single time or the whole day.</p>
            <div className="avail-form">
              <input
                className="modal-input avail-date-input"
                type="date"
                value={blockDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setBlockDate(e.target.value)}
                aria-label="Date to block"
              />
              <select
                className="modal-select avail-time-select"
                value={blockTime}
                onChange={(e) => setBlockTime(e.target.value)}
                aria-label="Time to block"
                disabled={blockAllDay || activeTimeSlots.length === 0}
              >
                {activeTimeSlots.map((s) => (
                  <option key={s.id} value={s.display_label}>{s.display_label}</option>
                ))}
              </select>
              <label className="avail-all-day-check">
                <input
                  type="checkbox"
                  checked={blockAllDay}
                  onChange={(e) => setBlockAllDay(e.target.checked)}
                />
                <span>Whole day</span>
              </label>
              <button
                type="button"
                className="admin-btn avail-block-btn"
                disabled={!blockDate || blockLoading || (!blockAllDay && !blockTime)}
                onClick={blockSlot}
              >
                {blockLoading ? "Blocking…" : "Block"}
              </button>
            </div>
            {blockError && <div className="modal-error avail-error">{blockError}</div>}
            <div className="avail-list">
              {availLoading ? (
                <p className="admin-empty">Loading…</p>
              ) : blockedSlots.length === 0 ? (
                <p className="admin-empty">No blocked slots.</p>
              ) : (
                blockedSlots.map((s) => (
                  <div key={s.id} className="avail-row">
                    <span className="avail-date">{s.date}</span>
                    <span className="avail-time">{s.all_day ? "All day" : (s.time ?? "")}</span>
                    <button
                      type="button"
                      className="admin-btn cancel"
                      disabled={updating === s.id}
                      onClick={() => unblockSlot(s.id)}
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
