"use client";

import { useState, useEffect } from "react";
import { parseBookingNotes } from "@/lib/booking-notes";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import WeeklyTemplateEditor from "@/components/WeeklyTemplateEditor";

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

type BookingFilter = "all" | "upcoming" | "pending" | "unpaid" | "cancelled";

const LESSON_NAMES: Record<string, string> = {
  beginner: "Foundations",
  advanced: "Strategy Lab",
  clinic: "Group Clinic",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BOOKING_TIME_ZONE = "America/Chicago";
const BOOKING_FILTERS: Array<{ value: BookingFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "pending", label: "Pending" },
  { value: "unpaid", label: "Unpaid" },
  { value: "cancelled", label: "Cancelled" },
];

function formatAdminDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function groupBlockedSlots(slots: BlockedSlot[]): Array<{ date: string; items: BlockedSlot[] }> {
  const groups = new Map<string, BlockedSlot[]>();
  [...slots]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .forEach((slot) => {
      const existing = groups.get(slot.date) ?? [];
      existing.push(slot);
      groups.set(slot.date, existing);
    });

  return Array.from(groups, ([date, items]) => ({ date, items }));
}

async function responseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === "string" ? data.error : fallback;
}

function todayDateString(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function contactHref(phone: string | null, scheme: "sms" | "tel"): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 7) return null;
  return `${scheme}:${digits}`;
}

export default function AdminDashboard({ initialBookings, initialInquiries }: Props) {
  const [tab, setTab] = useState<"bookings" | "inquiries" | "availability">(() => {
    if (typeof window === "undefined") return "bookings";
    const saved = localStorage.getItem("admin-dashboard-tab");
    return (["bookings", "inquiries", "availability"] as const).includes(saved as "bookings")
      ? (saved as "bookings" | "inquiries" | "availability")
      : "bookings";
  });
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
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
  const [weeklyTemplateSaving, setWeeklyTemplateSaving] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);
  const [availFetchError, setAvailFetchError] = useState("");
  const [calendarSync, setCalendarSync] = useState<CalendarSyncStatus | null>(null);
  const [hasLoadedAvail, setHasLoadedAvail] = useState(false);

  const activeTimeSlots = timeSlots.filter((s) => s.active);
  const hiddenTimeSlots = timeSlots.filter((s) => !s.active);
  const groupedBlockedSlots = groupBlockedSlots(blockedSlots);
  const today = todayDateString();
  const bookingFilterCount = (filter: BookingFilter) =>
    bookings.filter((booking) => {
      if (filter === "all") return true;
      if (filter === "upcoming") return booking.lesson_date >= today && booking.status !== "cancelled";
      if (filter === "pending") return booking.status === "pending";
      if (filter === "unpaid") return !booking.paid_at && booking.status !== "cancelled";
      return booking.status === "cancelled";
    }).length;
  const visibleBookings = bookings.filter((booking) => {
    if (bookingFilter === "all") return true;
    if (bookingFilter === "upcoming") return booking.lesson_date >= today && booking.status !== "cancelled";
    if (bookingFilter === "pending") return booking.status === "pending";
    if (bookingFilter === "unpaid") return !booking.paid_at && booking.status !== "cancelled";
    return booking.status === "cancelled";
  });
  const calendarStatusLabel = calendarSync
    ? calendarSync.enabled
      ? calendarSync.configured
        ? calendarSync.ok
          ? "Google Calendar Connected"
          : "Calendar Needs Attention"
        : "Missing OAuth Values"
      : "Calendar Sync Disabled"
    : "Checking Calendar";

  const unread = inquiries.filter((i) => !i.read).length;

  useEffect(() => {
    if (tab !== "availability" || hasLoadedAvail) return;
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
        setHasLoadedAvail(true);
      })
      .catch(() => setAvailFetchError("Failed to load availability. Please refresh the page."))
      .finally(() => setAvailLoading(false));
  }, [tab, hasLoadedAvail]);

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

  async function saveWeeklyTemplate(blocks: Array<{ day_of_week: number; time: string | null }>) {
    setWeeklyTemplateSaving(true);
    setRecurringError("");
    try {
      // Delete all existing recurring blocks
      for (const r of recurringBlocks) {
        await fetch(`/api/recurring-blocks/${r.id}`, { method: "DELETE" });
      }
      // Insert new ones
      const created = [];
      for (const b of blocks) {
        const res = await fetch("/api/recurring-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day_of_week: b.day_of_week, time: b.time }),
        });
        if (res.ok) created.push(await res.json());
      }
      setRecurringBlocks(created.sort((a, b) => a.day_of_week - b.day_of_week || (a.time ?? "").localeCompare(b.time ?? "")));
    } catch {
      // On partial failure, refetch to restore consistency
      const res = await fetch("/api/recurring-blocks");
      if (res.ok) setRecurringBlocks(await res.json());
      setRecurringError("Some rules could not be saved. Please check the list below.");
    } finally {
      setWeeklyTemplateSaving(false);
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
        <button type="button" className={`admin-tab${tab === "bookings" ? " active" : ""}`} onClick={() => { setTab("bookings"); localStorage.setItem("admin-dashboard-tab", "bookings"); }}>
          Bookings
        </button>
        <button type="button" className={`admin-tab${tab === "inquiries" ? " active" : ""}`} onClick={() => { setTab("inquiries"); localStorage.setItem("admin-dashboard-tab", "inquiries"); }}>
          Inquiries
          {unread > 0 && <span className="unread-dot" />}
        </button>
        <button type="button" className={`admin-tab${tab === "availability" ? " active" : ""}`} onClick={() => { setTab("availability"); localStorage.setItem("admin-dashboard-tab", "availability"); }}>
          Availability
        </button>
      </div>

      {tab !== "bookings" && updateError && <div className="modal-error">{updateError}</div>}

      {tab === "bookings" && (
        <>
          {updateError && <div className="modal-error">{updateError}</div>}
          <div className="booking-filter-bar" aria-label="Booking filters">
            {BOOKING_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`booking-filter${bookingFilter === filter.value ? " active" : ""}`}
                onClick={() => setBookingFilter(filter.value)}
                aria-label={`${filter.label} bookings (${bookingFilterCount(filter.value)})`}
              >
                <span>{filter.label}</span>
                <strong>{bookingFilterCount(filter.value)}</strong>
              </button>
            ))}
          </div>
          <div className="admin-table-scroll">
            {visibleBookings.length === 0 ? (
              <p className="admin-empty">
                {bookings.length === 0 ? "No bookings yet." : "No bookings match this filter."}
              </p>
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
                  {visibleBookings.map((b) => {
                    const court = parseBookingNotes(b.notes);
                    const smsHref = contactHref(b.phone, "sms");
                    const telHref = contactHref(b.phone, "tel");
                    return (
                      <tr key={b.id}>
                        <td>{b.lesson_date}</td>
                        <td>{b.lesson_time}</td>
                        <td>
                          <div className="td-name">{b.name}</div>
                          <div className="td-email-sub">{b.email}</div>
                          {b.phone && <div className="td-phone-sub">{b.phone}</div>}
                          {(smsHref || telHref) && (
                            <div className="td-contact-actions">
                              {smsHref && <a href={smsHref} aria-label={`Text ${b.name}`}>Text</a>}
                              {telHref && <a href={telHref} aria-label={`Call ${b.name}`}>Call</a>}
                            </div>
                          )}
                          {(court.courtSetup || court.preferredArea || court.raw) && (
                            <div className="td-court-note">
                              {court.courtSetup && <span>Court: {court.courtSetup}</span>}
                              {court.preferredArea && <span>Area: {court.preferredArea}</span>}
                              {!court.courtSetup && court.raw && <span>{court.raw}</span>}
                            </div>
                          )}
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
                              disabled={b.status !== "pending" || updating === b.id}
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
                    );
                  })}
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

          <div className="availability-hero">
            <div>
              <h2>DeMario&apos;s schedule</h2>
              <p>Click any day on the calendar to block or unblock it. Use the weekly schedule to set days Mario is always unavailable.</p>
            </div>
            <div className={`calendar-status-card${calendarSync?.ok ? " is-good" : ""}`}>
              <span className="status-dot" />
              <div>
                <strong>{calendarStatusLabel}</strong>
                <p>
                  {calendarSync
                    ? calendarSync.ok
                      ? `${calendarSync.busyCount} busy block${calendarSync.busyCount === 1 ? "" : "s"} found for ${calendarSync.checkedDate}.`
                      : calendarSync.error ?? "Mario can still use manual blocks while this is checked."
                    : "Checking the calendar diagnostic now."}
                </p>
              </div>
            </div>
          </div>

          {availLoading ? (
            <section className="avail-card">
              <p className="admin-empty">Loading calendar…</p>
            </section>
          ) : hasLoadedAvail ? (
            <section className="avail-card">
              <div className="avail-card-head">
                <div>
                  <h2 className="avail-section-title">Monthly calendar</h2>
                  <p className="avail-section-sub">Click any day to block or unblock times. Green = open, yellow = some blocked, red = fully blocked, blue = has a booking.</p>
                </div>
              </div>
              <AvailabilityCalendar
                blockedSlots={blockedSlots}
                timeSlots={timeSlots}
                onBlockSlot={async (date, time, allDay) => {
                  const payload = allDay ? { date, all_day: true } : { date, time };
                  const res = await fetch("/api/blocked-slots", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setBlockedSlots((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")));
                  }
                }}
                onUnblockSlot={async (id) => {
                  if (!window.confirm("Unblock this date or time?")) return;
                  const res = await fetch(`/api/blocked-slots/${id}`, { method: "DELETE" });
                  if (res.ok) setBlockedSlots((prev) => prev.filter((s) => s.id !== id));
                }}
              />
            </section>
          ) : null}

          <section className="avail-card">
            <div className="avail-card-head">
              <div>
                <h2 className="avail-section-title">Block a specific date</h2>
                <p className="avail-section-sub">Use this to block a single day or time — for a tournament, travel, or a day off.</p>
              </div>
            </div>
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
                {blockLoading ? "Blocking…" : "Block time"}
              </button>
            </div>
            {blockError && <div className="modal-error avail-error">{blockError}</div>}
          </section>

          <section className="avail-card">
            <div className="avail-card-head">
              <div>
                <h2 className="avail-section-title">Weekly schedule</h2>
                <p className="avail-section-sub">Set the days and times Mario is unavailable every week. Check a box to mark it unavailable, then save.</p>
              </div>
              <span className="avail-count-pill">{recurringBlocks.length} rule{recurringBlocks.length === 1 ? "" : "s"}</span>
            </div>
            {!availLoading && hasLoadedAvail && (
              <WeeklyTemplateEditor
                timeSlots={timeSlots}
                recurringBlocks={recurringBlocks}
                onSave={saveWeeklyTemplate}
                saving={weeklyTemplateSaving}
              />
            )}
            <details className="avail-advanced-toggle">
              <summary>Advanced: add or remove individual rules</summary>
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
                  <div className="admin-empty-state compact">
                    <strong>No weekly blocks.</strong>
                    <span>Add one when Mario has a normal day or time off.</span>
                  </div>
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
            </details>
          </section>

          <details className="avail-advanced-toggle avail-settings-toggle">
            <summary>Settings: lesson times &amp; blocked dates list</summary>
            <section className="avail-card avail-card-inset">
              <div className="avail-card-head">
                <div>
                  <h2 className="avail-section-title">Lesson times students can book</h2>
                  <p className="avail-section-sub">Active times appear in the booking form immediately. Add or hide times here.</p>
                </div>
                <span className="avail-count-pill">{activeTimeSlots.length} active</span>
              </div>
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
              <div className="slot-pill-list">
                {availLoading ? (
                  <p className="admin-empty">Loading…</p>
                ) : timeSlots.length === 0 ? (
                  <div className="admin-empty-state">
                    <strong>No lesson times yet.</strong>
                    <span>Add the first time above so students can book.</span>
                  </div>
                ) : (
                  timeSlots.map((slot) => (
                    <div key={slot.id} className={`slot-admin-pill${slot.active ? "" : " is-hidden"}`}>
                      <span>{slot.display_label}</span>
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
              {hiddenTimeSlots.length > 0 && (
                <p className="avail-section-sub muted-note">
                  Hidden times stay saved for later, but students cannot book them.
                </p>
              )}
            </section>

            <section className="avail-card avail-card-inset">
              <div className="avail-card-head">
                <div>
                  <h2 className="avail-section-title">All blocked dates</h2>
                  <p className="avail-section-sub">All one-off blocks Mario has added. Use the calendar above to unblock a day.</p>
                </div>
                <span className="avail-count-pill">{blockedSlots.length} block{blockedSlots.length === 1 ? "" : "s"}</span>
              </div>
              <div className="avail-list">
                {availLoading ? (
                  <p className="admin-empty">Loading…</p>
                ) : blockedSlots.length === 0 ? (
                  <div className="admin-empty-state compact">
                    <strong>No manual blocks yet.</strong>
                    <span>Block a date using the calendar or the form above.</span>
                  </div>
                ) : (
                  groupedBlockedSlots.map((group) => (
                    <div key={group.date} className="blocked-date-group">
                      <div className="blocked-date-heading">{formatAdminDate(group.date)}</div>
                      <div className="blocked-date-items">
                        {group.items.map((s) => (
                          <div key={s.id} className="avail-row">
                            <span className="avail-date">{s.all_day ? "Whole day" : (s.time ?? "")}</span>
                            <button
                              type="button"
                              className="admin-btn cancel"
                              disabled={updating === s.id}
                              onClick={() => unblockSlot(s.id)}
                            >
                              Unblock
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </details>
        </div>
      )}
    </div>
  );
}
