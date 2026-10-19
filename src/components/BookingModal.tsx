"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateDays, type DaySlot } from "@/lib/data";
import { COURT_CONFIRMATION_MESSAGE, LESSON_LOCATION } from "@/lib/business";
import { COURT_SETUP_OPTIONS, formatBookingNotes, type CourtSetup } from "@/lib/booking-notes";
import {
  COURT_SETUP_HINTS,
  INDOOR_ROUTING_OPTIONS,
  TEXT_MARIO_HREF,
  type VenueRule,
} from "@/lib/venue-rules";
import {
  bookingFailure,
  courtSetupCode,
  eventAttributes,
  trackEvent,
  venueCode,
  type BookingStep,
} from "@/lib/analytics";
import PaymentOptions from "./PaymentOptions";
import TermsContent, { TERMS_EFFECTIVE_DATE } from "./TermsContent";

type Step = "form" | "terms" | "indoorRouting" | "picker" | "loading" | "error" | "confirmed";

// The funnel names for each step a student actually sees. "loading" is a
// spinner between picker and confirmed, not a step.
const STEP_CODES: Record<Exclude<Step, "loading">, BookingStep> = {
  form: "details",
  terms: "terms",
  indoorRouting: "indoor_routing",
  picker: "picker",
  error: "error",
  confirmed: "confirmed",
};

interface FormData {
  name: string;
  email: string;
  phone: string;
  lessonType: "beginner" | "advanced" | "clinic";
  courtSetup: CourtSetup | "";
  preferredCourt: string;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLessonType?: FormData["lessonType"];
}

const LESSON_LABELS: Record<string, string> = {
  beginner: "Foundations ($70)",
  advanced: "Strategy Lab ($80)",
  clinic: "Group Clinic ($50)",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\-()+]{7,20}$/;

const LESSON_PRICES: Record<string, string> = {
  beginner: "$70.00",
  advanced: "$80.00",
  clinic: "$50.00",
};

const RouteArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 17L17 7M7 7h10v10" />
  </svg>
);

const TextIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

function VenueRouteCard({ venue }: { venue: VenueRule }) {
  const linked = Boolean(venue.href);
  const code = venueCode(venue.shortName);
  const content = (
    <>
      <div className="venue-route-copy">
        <span>{venue.bookingOwner}</span>
        <strong>{venue.name}</strong>
        <p>{venue.summary}</p>
      </div>
      <div className={`venue-route-action${linked ? "" : " venue-route-action-static"}`}>
        {venue.ctaLabel ?? (linked ? "Open booking path" : "Use required venue path")}
        {linked && <RouteArrowIcon />}
      </div>
    </>
  );

  return venue.href ? (
    <a
      href={venue.href}
      target="_blank"
      rel="noopener noreferrer"
      className="venue-route-card"
      {...(code ? eventAttributes("venue_link_click", { venue: code, surface: "modal" }) : {})}
    >
      {content}
    </a>
  ) : (
    <div className="venue-route-card venue-route-card-static">
      {content}
    </div>
  );
}

export default function BookingModal({ isOpen, onClose, initialLessonType = "beginner" }: BookingModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    lessonType: initialLessonType,
    courtSetup: "",
    preferredCourt: "",
  });
  const [days, setDays] = useState<DaySlot[]>(() => generateDays());
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [timesLoaded, setTimesLoaded] = useState(false);
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [allDay, setAllDay] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState("");
  const [pickerError, setPickerError] = useState("");
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [company, setCompany] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingId, setBookingId] = useState("");
  const submittingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Steps already reported in this opening of the form. See showStep.
  const viewedStepsRef = useRef<Set<BookingStep>>(new Set());

  const fetchAvailability = useCallback(async (
    dateStr: string,
    availableTimes: string[],
    lessonType: FormData["lessonType"]
  ) => {
    setAvailLoading(true);
    setAvailError("");
    try {
      const params = new URLSearchParams({
        date: dateStr,
        lesson_type: lessonType,
      });
      const res = await fetch(`/api/availability?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load availability.");
      const { unavailable = [], allDay: fullDay = false } = await res.json();
      const unavailableSet = new Set<string>(unavailable);
      setBookedTimes(unavailableSet);
      setAllDay(fullDay);
      setSelectedTime((prev) => {
        if (fullDay) return "";
        if (prev && !unavailableSet.has(prev) && availableTimes.includes(prev)) return prev;
        return availableTimes.find((t) => !unavailableSet.has(t)) ?? "";
      });
    } catch {
      setAvailError("Could not load availability. Please try again.");
    } finally {
      setAvailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      const freshDays = generateDays();
      setDays(freshDays);
      document.body.style.overflow = "hidden";
      setStep("form");
      viewedStepsRef.current = new Set(["details"]);
      trackEvent("booking_step_viewed", { step: "details" });
      setForm({
        name: "",
        email: "",
        phone: "",
        lessonType: initialLessonType,
        courtSetup: "",
        preferredCourt: "",
      });
      setSelectedDay(0);
      setTimes([]);
      setTimesLoaded(false);
      setBookedTimes(new Set());
      setAllDay(false);
      setSelectedTime("");
      setWaiverAgreed(false);
      setCompany("");
      setAvailError("");
      setPickerError("");
      setErrorMsg("");
      setBookingId("");

      fetch("/api/time-slots")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load times"))))
        .then((data: { display_label: string }[]) => {
          const loaded = data.map((d) => d.display_label);
          setTimes(loaded);
          setTimesLoaded(true);
        })
        .catch(() => {
          setTimesLoaded(true);
          setAvailError("Could not load times. Please refresh.");
        });
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, initialLessonType]);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const modal = modalRef.current;
      if (!modal) return;
      // Tab can never land on tabIndex -1 or inside an aria-hidden wrapper. The
      // honeypot input is both, and it is the last input in the form, so keeping
      // it made `last` unreachable and focus walked out of the dialog.
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.tabIndex >= 0 && !el.closest('[aria-hidden="true"]'));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Moves to a step and reports its first view in this opening, so the step
  // totals form a funnel: Back, Try again, and a taken slot return to a step
  // without counting it twice. Court setup rides along once it is chosen:
  // routing and the time picker.
  function showStep(next: Exclude<Step, "loading">) {
    setStep(next);
    const step = STEP_CODES[next];
    if (viewedStepsRef.current.has(step)) return;
    viewedStepsRef.current.add(step);
    trackEvent("booking_step_viewed", {
      step,
      court_setup:
        next === "indoorRouting" || next === "picker" ? courtSetupCode(form.courtSetup) : undefined,
    });
  }

  function handleDaySelect(i: number) {
    setSelectedDay(i);
    setPickerError("");
    fetchAvailability(days[i].dateStr, times, form.lessonType);
  }

  async function confirmBooking() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStep("loading");
    setPickerError("");
    let failureReported = false;
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
          notes: form.courtSetup
            ? formatBookingNotes({
                courtSetup: form.courtSetup,
                preferredArea: form.preferredCourt,
              })
            : undefined,
          waiver_accepted: waiverAgreed,
          company,
        }),
      });
      if (res.status === 409) {
        trackEvent("booking_failed", { reason: "slot_taken" });
        await fetchAvailability(day.dateStr, times, form.lessonType);
        setPickerError("That time was just taken. Please pick another.");
        showStep("picker");
        return;
      }
      if (!res.ok) {
        trackEvent("booking_failed", { reason: bookingFailure(res.status) });
        failureReported = true;
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Booking failed. Please try again.");
      }
      // The booking is saved once the server answers 201. A body lost to a
      // dropped connection must not show the error screen or count as a failure.
      const data = await res.json().catch(() => ({}));
      setBookingId(data.id ?? "");
      showStep("confirmed");
    } catch (err) {
      // A throw that the !res.ok branch did not report is the request itself
      // failing: offline, DNS, or the connection dropping.
      if (!failureReported) trackEvent("booking_failed", { reason: "network" });
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      showStep("error");
    } finally {
      submittingRef.current = false;
    }
  }

  function handleContinue() {
    if (form.courtSetup === "Indoor / weather-proof") {
      setPickerError("");
      showStep("indoorRouting");
      return;
    }
    fetchAvailability(days[selectedDay].dateStr, times, form.lessonType);
    showStep("picker");
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!isOpen) return null;

  const day = days[selectedDay];
  const lessonName = LESSON_LABELS[form.lessonType].split(" (")[0];
  const lessonPrice = LESSON_PRICES[form.lessonType];
  const availableCount = times.filter((t) => !bookedTimes.has(t)).length;
  const phoneValue = form.phone.trim();
  const phoneValid = PHONE_RE.test(phoneValue) && phoneValue.replace(/\D/g, "").length >= 7;
  const courtSetupHint = form.courtSetup ? COURT_SETUP_HINTS[form.courtSetup] : "";
  const needsSiteTimes = form.courtSetup !== "Indoor / weather-proof";
  const continueLabel = needsSiteTimes && !timesLoaded
    ? "Loading lesson times..."
    : form.courtSetup === "Indoor / weather-proof"
    ? "See indoor booking paths"
    : "Continue to available times";
  const canContinue =
    form.name.trim().length >= 2 &&
    EMAIL_RE.test(form.email) &&
    phoneValid &&
    Boolean(form.courtSetup) &&
    waiverAgreed &&
    (!needsSiteTimes || timesLoaded);

  return (
    <div className="modal-backdrop open" onClick={handleBackdropClick}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        <div className="modal-grip" />
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {step === "loading" ? "Confirming your booking" : step === "confirmed" ? "Booking confirmed" : step === "error" ? "There was a booking error" : step === "indoorRouting" ? "Showing indoor booking paths" : step === "terms" ? "Showing coaching terms" : ""}
        </div>
        <button
          type="button"
          className="modal-close"
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {step === "form" && (
          <>
            <h3 id="booking-modal-title">Book a lesson</h3>
            <p className="m-sub">Tell us who is coming, where you prefer to train, then pick the time that fits.</p>
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
              <label htmlFor="bm-phone">Phone</label>
              <input
                id="bm-phone"
                className="modal-input"
                type="tel"
                placeholder="(555) 000-0000"
                value={form.phone}
                maxLength={20}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="field-hint">Used for court confirmation and weather updates.</p>
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
            <div className="modal-form-group">
              <label htmlFor="court-setup">Preferred court setup</label>
              <select
                id="court-setup"
                className="modal-select"
                value={form.courtSetup}
                onChange={(e) =>
                  setForm({ ...form, courtSetup: e.target.value as FormData["courtSetup"] })
                }
              >
                <option value="">Choose one</option>
                {COURT_SETUP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {courtSetupHint && <p className="field-hint">{courtSetupHint}</p>}
            </div>
            <div className="modal-form-group">
              <label htmlFor="preferred-court">Preferred area or court (optional)</label>
              <input
                id="preferred-court"
                className="modal-input"
                type="text"
                placeholder="Near Lake Highlands, The Grove, Life Time, etc."
                value={form.preferredCourt}
                maxLength={160}
                onChange={(e) => setForm({ ...form, preferredCourt: e.target.value })}
              />
            </div>
            <div className="waiver-check">
              <input
                id="bm-waiver"
                type="checkbox"
                checked={waiverAgreed}
                onChange={(e) => setWaiverAgreed(e.target.checked)}
              />
              <span>
                <label htmlFor="bm-waiver">I have read and agree to the </label>
                <button
                  type="button"
                  className="waiver-link"
                  onClick={() => showStep("terms")}
                >
                  Coaching Agreement &amp; Terms
                </button>
              </span>
            </div>
            <div className="honeypot-field" aria-hidden="true">
              <label htmlFor="bm-company">Company</label>
              <input
                id="bm-company"
                type="text"
                name="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue}
              onClick={handleContinue}
            >
              {continueLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {step === "terms" && (
          <>
            <h3 id="booking-modal-title">Coaching Agreement &amp; Terms</h3>
            <p className="m-sub">{TERMS_EFFECTIVE_DATE}</p>
            <div className="modal-legal-copy">
              <TermsContent />
            </div>
            <button
              type="button"
              className="btn btn-ghost terms-back"
              onClick={() => showStep("form")}
            >
              Back to booking
            </button>
          </>
        )}

        {step === "indoorRouting" && (
          <>
            <h3 id="booking-modal-title">Indoor courts use partner booking</h3>
            <p className="m-sub">
              Pick the venue path first so the court reservation, payment,
              waiver, and membership rules stay in the right system.
            </p>

            <div className="venue-route-list">
              {INDOOR_ROUTING_OPTIONS.map((venue) => (
                <VenueRouteCard key={venue.name} venue={venue} />
              ))}
            </div>

            <div className="venue-route-help">
              <div>
                <span>Not sure which one fits?</span>
                <strong>Mario can route it for you.</strong>
              </div>
              <a
                href={TEXT_MARIO_HREF}
                className="btn btn-primary venue-route-text"
                {...eventAttributes("contact_click", { channel: "sms", surface: "modal" })}
              >
                Text Mario
                <TextIcon />
              </a>
            </div>

            <button
              type="button"
              className="btn btn-ghost venue-route-back"
              onClick={() => showStep("form")}
            >
              Back to court setup
            </button>
          </>
        )}

        {step === "picker" && (
          <>
            <h3 id="booking-modal-title">Choose a time</h3>
            <p className="m-sub">
              {lessonName} · {LESSON_LOCATION}
            </p>

            <div className="booking-choice-summary">
              <div>
                <span>Lesson</span>
                <strong>{lessonName}</strong>
              </div>
              <div>
                <span>Price</span>
                <strong>{lessonPrice}</strong>
              </div>
              <div>
                <span>Timezone</span>
                <strong>Central Time</strong>
              </div>
              <div>
                <span>Court</span>
                <strong>{form.courtSetup}</strong>
              </div>
            </div>

            <section className="booking-picker-panel">
              <div className="picker-section-head">
                <div>
                  <span>Step 1</span>
                  <h4>Select a day</h4>
                </div>
                <p>Showing the next 30 days</p>
              </div>
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
            </section>

            <section className="booking-picker-panel">
              <div className="picker-section-head">
                <div>
                  <span>Step 2</span>
                  <h4>Select a time <em>CT</em></h4>
                </div>
                {!availLoading && times.length > 0 && !availError && !allDay && (
                  <p>{availableCount} open</p>
                )}
              </div>
            {availLoading || !timesLoaded ? (
              <div className="avail-loading">
                <div className="spinner" />
              </div>
            ) : availError ? (
              <div className="avail-fetch-error">
                <div className="modal-error">{availError}</div>
                <button type="button" className="btn btn-ghost avail-retry-btn" onClick={() => fetchAvailability(days[selectedDay].dateStr, times, form.lessonType)}>
                  Retry
                </button>
              </div>
            ) : allDay ? (
              <div className="avail-all-day">
                DeMario is unavailable on this date. Pick another date.
              </div>
            ) : times.length === 0 ? (
              <div className="avail-all-day">
                No lesson times available yet - check back soon or contact DeMario directly.
              </div>
            ) : (
              <div className="time-grid">
                {times.map((t) => {
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
            </section>
            {pickerError && <div className="modal-error">{pickerError}</div>}
            <div className="picker-actions">
              <button
                type="button"
                className="btn btn-ghost picker-back"
                onClick={() => showStep("form")}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary picker-confirm"
                disabled={!selectedTime || availLoading}
                onClick={confirmBooking}
              >
                Reserve {selectedTime || "time"}
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
            <h3 id="booking-modal-title">Something went wrong</h3>
            <div className="modal-error">{errorMsg}</div>
            <button type="button" className="btn btn-ghost" onClick={() => showStep("picker")}>
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
            <h3 id="booking-modal-title">You&apos;re booked.</h3>
            <p className="m-sub">
              {day.d} {day.n} at {selectedTime} CT · confirmation email sent.
            </p>
            <p className="confirm-note">{COURT_CONFIRMATION_MESSAGE}</p>
            <div className="booking-summary">
              <div className="booking-summary-row">
                <span>Date and time</span>
                <strong>{day.d} {day.n} · {selectedTime}</strong>
              </div>
              <div className="booking-summary-row">
                <span>Lesson</span>
                <strong>{lessonName}</strong>
              </div>
              <div className="booking-summary-row">
                <span>Coach</span>
                <strong>DeMario Montez</strong>
              </div>
              <div className="booking-summary-row">
                <span>Court</span>
                <strong>{LESSON_LOCATION}</strong>
              </div>
              <div className="booking-summary-row">
                <span>Preference</span>
                <strong>{form.courtSetup}</strong>
              </div>
              <div className="booking-summary-row">
                <span>Lesson fee due</span>
                <strong className="accent">{lessonPrice}</strong>
              </div>
              {bookingId && (
                <div className="booking-summary-row">
                  <span>Booking ID</span>
                  <strong className="booking-id-val">{bookingId.slice(0, 8).toUpperCase()}</strong>
                </div>
              )}
            </div>
            <PaymentOptions bookingId={bookingId} amount={lessonPrice} />
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
