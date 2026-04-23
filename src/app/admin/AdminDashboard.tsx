"use client";

import { useState } from "react";

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
}

interface Inquiry {
  id: string;
  created_at: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
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

export default function AdminDashboard({
  initialBookings,
  initialInquiries,
}: Props) {
  const [tab, setTab] = useState<"bookings" | "inquiries">("bookings");
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [updating, setUpdating] = useState<string | null>(null);

  const unread = initialInquiries.filter((i) => !i.read).length;

  async function updateStatus(id: string, status: "confirmed" | "cancelled") {
    setUpdating(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: updated.status } : b))
        );
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
        <button
          type="button"
          className={`admin-tab${tab === "bookings" ? " active" : ""}`}
          onClick={() => setTab("bookings")}
        >
          Bookings
        </button>
        <button
          type="button"
          className={`admin-tab${tab === "inquiries" ? " active" : ""}`}
          onClick={() => setTab("inquiries")}
        >
          Inquiries
          {unread > 0 && <span className="unread-dot" />}
        </button>
      </div>

      {tab === "bookings" && (
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
                      <span className={`status-badge status-${b.status}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <div className="td-actions">
                        <button
                          type="button"
                          className="admin-btn confirm"
                          disabled={
                            b.status === "confirmed" || updating === b.id
                          }
                          onClick={() => updateStatus(b.id, "confirmed")}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="admin-btn cancel"
                          disabled={
                            b.status === "cancelled" || updating === b.id
                          }
                          onClick={() => updateStatus(b.id, "cancelled")}
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
      )}

      {tab === "inquiries" && (
        <div>
          {initialInquiries.length === 0 ? (
            <p className="admin-empty">No inquiries yet.</p>
          ) : (
            initialInquiries.map((inq) => (
              <div key={inq.id} className="inquiry-card">
                <div className="inq-name">
                  {inq.name}
                  {!inq.read && <span className="unread-dot" />}
                </div>
                <div className="inq-email">{inq.email}</div>
                <div className="inq-msg">{inq.message}</div>
                <div className="inq-date">
                  {new Date(inq.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
