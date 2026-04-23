"use client";

import { useState, useEffect } from "react";
import { TIMES, BOOKED, generateDays, type DaySlot } from "@/lib/data";

type Step = "form" | "picker" | "loading" | "error" | "confirmed";

interface FormData {
  name: string;
  email: string;
  phone: string;
  lessonType: "beginner" | "advanced" | "clinic";
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LESSON_LABELS: Record<string, string> = {
  beginner: "Foundations ($90)",
  advanced: "Strategy Lab ($125)",
  clinic: "Group Clinic ($55)",
};

const LESSON_PRICES: Record<string, string> = {
  beginner: "$90.00",
  advanced: "$125.00",
  clinic: "$55.00",
};

const FIRST_AVAILABLE = TIMES.find((t) => !BOOKED.has(t)) ?? TIMES[0];

export default function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    lessonType: "beginner",
  });
  const [days] = useState<DaySlot[]>(() => generateDays());
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState(FIRST_AVAILABLE);
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingId, setBookingId] = useState("");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setStep("form");
      setForm({ name: "", email: "", phone: "", lessonType: "beginner" });
      setSelectedDay(0);
      setSelectedTime(FIRST_AVAILABLE);
      setWaiverAgreed(false);
      setErrorMsg("");
      setBookingId("");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  async function confirmBooking() {
    setStep("loading");
    try {
      const day = days[selectedDay];
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          lesson_type: form.lessonType,
          lesson_date: day.dateStr,
          lesson_time: selectedTime,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Booking failed. Please try again.");
      }
      const data = await res.json();
      setBookingId(data.id ?? "");
      setStep("confirmed");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStep("error");
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!isOpen) return null;

  const day = days[selectedDay];

  return (
    <div className="modal-backdrop open" onClick={handleBackdropClick}>
      <div className="modal">
        <div className="modal-grip" />
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {step === "form" && (
          <>
            <h3>Book a lesson</h3>
            <p className="m-sub">Fill in your details to reserve a spot.</p>
            <div className="modal-form-group">
              <label>Your name</label>
              <input
                className="modal-input"
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="modal-form-group">
              <label>Email</label>
              <input
                className="modal-input"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="modal-form-group">
              <label>Phone (optional)</label>
              <input
                className="modal-input"
                type="tel"
                placeholder="(555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="lesson-type">Lesson type</label>
              <select
                id="lesson-type"
                className="modal-select"
                value={form.lessonType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lessonType: e.target.value as FormData["lessonType"],
                  })
                }
              >
                <option value="beginner">Foundations ($90)</option>
                <option value="advanced">Strategy Lab ($125)</option>
                <option value="clinic">Group Clinic ($55)</option>
              </select>
            </div>
            <label className="waiver-check">
              <input
                type="checkbox"
                checked={waiverAgreed}
                onChange={(e) => setWaiverAgreed(e.target.checked)}
              />
              <span>
                I have read and agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  Coaching Agreement &amp; Terms
                </a>
              </span>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!form.name || !form.email || !waiverAgreed}
              onClick={() => setStep("picker")}
            >
              Next — pick a time
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {step === "picker" && (
          <>
            <h3>Book a lesson</h3>
            <p className="m-sub">
              {LESSON_LABELS[form.lessonType]} · Dallas Indoor Pickleball Club
            </p>
            <div className="label-tag">Select day</div>
            <div className="slot-grid slot-grid-scroll">
              {days.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`slot${selectedDay === i ? " selected" : ""}`}
                  onClick={() => setSelectedDay(i)}
                >
                  <div className="d">{s.d}</div>
                  <div className="n">{s.n}</div>
                </button>
              ))}
            </div>
            <div className="label-tag mt">
              Select time <span className="tz-label">CT</span>
            </div>
            <div className="time-grid">
              {TIMES.map((t) => {
                const isBooked = BOOKED.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`time-slot${selectedTime === t ? " selected" : ""}${isBooked ? " booked" : ""}`}
                    disabled={isBooked}
                    onClick={() => !isBooked && setSelectedTime(t)}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="picker-actions">
              <button
                type="button"
                className="btn btn-ghost picker-back"
                onClick={() => setStep("form")}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-primary picker-confirm"
                onClick={confirmBooking}
              >
                Confirm {day.d} {day.n} · {selectedTime}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="modal-loading">
            <div className="spinner" />
            <span>Confirming your booking…</span>
          </div>
        )}

        {step === "error" && (
          <>
            <h3>Something went wrong</h3>
            <div className="modal-error">{errorMsg}</div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep("picker")}
            >
              Try again
            </button>
          </>
        )}

        {step === "confirmed" && (
          <div className="modal-confirmed">
            <div className="confirm-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3>You&apos;re booked.</h3>
            <p className="m-sub">
              {day.d} {day.n} at {selectedTime} · See you on the court.
            </p>
            <div className="booking-summary">
              <div className="booking-summary-row">
                <span>Lesson</span>
                <strong>{LESSON_LABELS[form.lessonType].split(" (")[0]}</strong>
              </div>
              <div className="booking-summary-row">
                <span>Coach</span>
                <strong>DeMario Montez</strong>
              </div>
              <div className="booking-summary-row">
                <span>Location</span>
                <strong>Dallas Indoor PBC</strong>
              </div>
              <div className="booking-summary-row">
                <span>Total</span>
                <strong className="accent">
                  {LESSON_PRICES[form.lessonType]}
                </strong>
              </div>
              {bookingId && (
                <div className="booking-summary-row">
                  <span>Booking ID</span>
                  <strong className="booking-id-val">
                    {bookingId.slice(0, 8).toUpperCase()}
                  </strong>
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
