"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TIMES, generateDays, type DaySlot } from "@/lib/data";
import PaymentOptions from "./PaymentOptions";

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
  beginner: "Foundations ($70)",
  advanced: "Strategy Lab ($80)",
  clinic: "Group Clinic ($50)",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LESSON_PRICES: Record<string, string> = {
  beginner: "$70.00",
  advanced: "$80.00",
  clinic: "$50.00",
};

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
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState("");
  const [pickerError, setPickerError] = useState("");
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingId, setBookingId] = useState("");
  const submittingRef = useRef(false);

  const fetchAvailability = useCallback(async (dateStr: string) => {
    setAvailLoading(true);
    setAvailError("");
    try {
      const res = await fetch(`/api/availability?date=${dateStr}`);
      if (!res.ok) throw new Error("Failed to load availability.");
      const { booked } = await res.json();
      const booked_set = new Set<string>(booked);
      setBookedTimes(booked_set);
      setSelectedTime((prev) => {
        if (prev && !booked_set.has(prev)) return prev;
        return TIMES.find((t) => !booked_set.has(t)) ?? TIMES[0];
      });
    } catch {
      setAvailError("Could not load availability. Please try again.");
    } finally {
      setAvailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setStep("form");
      setForm({ name: "", email: "", phone: "", lessonType: "beginner" });
      setSelectedDay(0);
      setBookedTimes(new Set());
      setSelectedTime("");
      setWaiverAgreed(false);
      setAvailError("");
      setPickerError("");
      setErrorMsg("");
      setBookingId("");
      fetchAvailability(days[0].dateStr);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, days, fetchAvailability]);

  function handleDaySelect(i: number) {
    setSelectedDay(i);
    setPickerError("");
    fetchAvailability(days[i].dateStr);
  }

  async function confirmBooking() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStep("loading");
    setPickerError("");
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
      if (res.status === 409) {
        await fetchAvailability(day.dateStr);
        setPickerError("That time was just taken. Please pick another.");
        setStep("picker");
        return;
      }
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
    } finally {
      submittingRef.current = false;
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
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {step === "loading" ? "Confirming your booking" : step === "confirmed" ? "Booking confirmed" : step === "error" ? "There was a booking error" : ""}
        </div>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {step === "form" && (
          <>
            <h3>Book a lesson</h3>
            <p className="m-sub">Fill in your details to reserve a spot.</p>
            <div className="modal-form-group">
              <label htmlFor="bm-name">Your name</label>
              <input
                id="bm-name"
                className="modal-input"
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                minLength={2}
                maxLength={120}
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="bm-email">Email</label>
              <input
                id="bm-email"
                className="modal-input"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="bm-phone">Phone (optional)</label>
              <input
                id="bm-phone"
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
                  setForm({ ...form, lessonType: e.target.value as FormData["lessonType"] })
                }
              >
                <option value="beginner">Foundations ($70)</option>
                <option value="advanced">Strategy Lab ($80)</option>
                <option value="clinic">Group Clinic ($50)</option>
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
              disabled={!form.name.trim() || !EMAIL_RE.test(form.email) || !waiverAgreed}
              onClick={() => setStep("picker")}
            >
              Next — pick a time
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                  aria-pressed={selectedDay === i ? "true" : "false"}
                  onClick={() => handleDaySelect(i)}
                >
                  <div className="d">{s.d}</div>
                  <div className="n">{s.n}</div>
                </button>
              ))}
            </div>
            <div className="label-tag mt">
              Select time <span className="tz-label">CT</span>
            </div>
            {availLoading ? (
              <div className="avail-loading">
                <div className="spinner" />
              </div>
            ) : availError ? (
              <div className="avail-fetch-error">
                <div className="modal-error">{availError}</div>
                <button type="button" className="btn btn-ghost avail-retry-btn" onClick={() => fetchAvailability(days[selectedDay].dateStr)}>
                  Retry
                </button>
              </div>
            ) : (
              <div className="time-grid">
                {TIMES.map((t) => {
                  const isBooked = bookedTimes.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`time-slot${selectedTime === t ? " selected" : ""}${isBooked ? " booked" : ""}`}
                      disabled={isBooked}
                      aria-pressed={(!isBooked && selectedTime === t) ? "true" : "false"}
                      onClick={() => {
                        if (!isBooked) {
                          setSelectedTime(t);
                          setPickerError("");
                        }
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
            {pickerError && <div className="modal-error">{pickerError}</div>}
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
                disabled={!selectedTime || availLoading}
                onClick={confirmBooking}
              >
                Confirm {day.d} {day.n} · {selectedTime || "…"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
            <button type="button" className="btn btn-ghost" onClick={() => setStep("picker")}>
              Try again
            </button>
          </>
        )}

        {step === "confirmed" && (
          <div className="modal-confirmed">
            <div className="confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                <strong className="accent">{LESSON_PRICES[form.lessonType]}</strong>
              </div>
              {bookingId && (
                <div className="booking-summary-row">
                  <span>Booking ID</span>
                  <strong className="booking-id-val">{bookingId.slice(0, 8).toUpperCase()}</strong>
                </div>
              )}
            </div>
            <PaymentOptions bookingId={bookingId} amount={LESSON_PRICES[form.lessonType]} />
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
