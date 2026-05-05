"use client";

import { useEffect, useState } from "react";
import type { DayStatus } from "@/app/api/availability/month/route";

interface TimeSlot {
  id: string;
  display_label: string;
  sort_key: number;
  active: boolean;
}

interface BlockedSlot {
  id: string;
  date: string;
  time: string | null;
  all_day: boolean;
}

interface Props {
  blockedSlots: BlockedSlot[];
  timeSlots: TimeSlot[];
  onBlockSlot: (date: string, time: string | null, allDay: boolean) => Promise<void>;
  onUnblockSlot: (id: string) => Promise<void>;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function todayString(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export default function AvailabilityCalendar({ blockedSlots, timeSlots, onBlockSlot, onUnblockSlot }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [monthData, setMonthData] = useState<Record<string, DayStatus>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [dayActionLoading, setDayActionLoading] = useState(false);

  const activeSlots = timeSlots.filter((s) => s.active).sort((a, b) => a.sort_key - b.sort_key);

  useEffect(() => {
    fetchMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function fetchMonth() {
    setLoadingMonth(true);
    try {
      const res = await fetch(`/api/availability/month?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setMonthData(data.days ?? {});
      }
    } finally {
      setLoadingMonth(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  async function handleBlockWholeDay() {
    if (!selectedDate) return;
    setDayActionLoading(true);
    try {
      await onBlockSlot(selectedDate, null, true);
      await fetchMonth();
    } finally {
      setDayActionLoading(false);
    }
  }

  async function handleUnblock(id: string) {
    setDayActionLoading(true);
    try {
      await onUnblockSlot(id);
      await fetchMonth();
    } finally {
      setDayActionLoading(false);
    }
  }

  async function handleBlockRange() {
    if (!selectedDate || !rangeFrom || !rangeTo) return;
    setRangeError("");

    const fromIdx = activeSlots.findIndex((s) => s.display_label === rangeFrom);
    const toIdx = activeSlots.findIndex((s) => s.display_label === rangeTo);
    if (fromIdx < 0 || toIdx < 0) { setRangeError("Select valid time slots."); return; }
    if (toIdx < fromIdx) { setRangeError("End time must be after start time."); return; }

    const slotsInRange = activeSlots.slice(fromIdx, toIdx + 1);
    const alreadyBlocked = new Set(
      blockedSlots
        .filter((b) => b.date === selectedDate && b.time !== null)
        .map((b) => b.time!)
    );
    const toBlock = slotsInRange.filter((s) => !alreadyBlocked.has(s.display_label));

    if (toBlock.length === 0) {
      setRangeError("All selected times are already blocked.");
      return;
    }

    setRangeLoading(true);
    try {
      for (const slot of toBlock) {
        await onBlockSlot(selectedDate, slot.display_label, false);
      }
      await fetchMonth();
      setRangeFrom("");
      setRangeTo("");
    } catch {
      setRangeError("Some slots could not be blocked.");
    } finally {
      setRangeLoading(false);
    }
  }

  const firstDow = new Date(`${isoDate(year, month, 1)}T12:00:00Z`).getUTCDay();
  const totalDays = daysInMonth(year, month);
  const today = todayString();

  const dayBlocksForSelected = selectedDate
    ? blockedSlots.filter((b) => b.date === selectedDate)
    : [];
  const selectedStatus = selectedDate ? monthData[selectedDate] : null;

  return (
    <div className="avail-cal-wrap">
      <div className="avail-cal-nav">
        <button type="button" className="avail-cal-nav-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
        <span className="avail-cal-nav-title">
          {loadingMonth ? "…" : `${MONTH_NAMES[month - 1]} ${year}`}
        </span>
        <button type="button" className="avail-cal-nav-btn" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      <div className="avail-cal-legend">
        <span className="avail-cal-legend-item"><span className="avail-cal-dot available" />Available</span>
        <span className="avail-cal-legend-item"><span className="avail-cal-dot partial" />Partial</span>
        <span className="avail-cal-legend-item"><span className="avail-cal-dot blocked" />Blocked</span>
        <span className="avail-cal-legend-item"><span className="avail-cal-dot booking" />Has booking</span>
      </div>

      <div className="avail-cal" role="grid">
        {DAY_LABELS.map((d) => (
          <div key={d} className="avail-cal-header" role="columnheader">{d}</div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`empty-${i}`} className="avail-cal-cell avail-cal-cell--empty" />
        ))}
        {Array.from({ length: totalDays }, (_, i) => {
          const day = i + 1;
          const dateStr = isoDate(year, month, day);
          const status = monthData[dateStr] ?? (dateStr < today ? "past" : "available");
          const isSelected = selectedDate === dateStr;
          const isPast = status === "past";
          return (
            <button
              key={dateStr}
              type="button"
              className={`avail-cal-cell avail-cal-cell--${status}${isSelected ? " avail-cal-cell--selected" : ""}`}
              onClick={() => !isPast && setSelectedDate(isSelected ? null : dateStr)}
              disabled={isPast}
              aria-label={`${dateStr} — ${status}`}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="avail-day-panel">
          <div className="avail-day-header">
            <span className="avail-day-title">{formatDisplayDate(selectedDate)}</span>
            <button type="button" className="avail-day-close" onClick={() => setSelectedDate(null)} aria-label="Close">×</button>
          </div>

          {dayBlocksForSelected.length > 0 && (
            <div className="avail-day-blocks">
              <p className="avail-day-section-label">Current blocks</p>
              {dayBlocksForSelected.map((b) => (
                <div key={b.id} className="avail-day-block-row">
                  <span>{b.all_day ? "All day" : (b.time ?? "—")}</span>
                  <button
                    type="button"
                    className="admin-btn cancel"
                    onClick={() => handleUnblock(b.id)}
                    disabled={dayActionLoading}
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedStatus !== "blocked" && (
            <>
              <div className="avail-day-actions">
                <p className="avail-day-section-label">Block options</p>
                <button
                  type="button"
                  className="btn btn-ghost avail-day-block-all"
                  onClick={handleBlockWholeDay}
                  disabled={dayActionLoading}
                >
                  Block whole day
                </button>
              </div>

              {activeSlots.length >= 2 && (
                <div className="avail-range-wrap">
                  <p className="avail-day-section-label">Block a time range</p>
                  <div className="avail-range-row">
                    <select
                      className="modal-select"
                      aria-label="From time"
                      value={rangeFrom}
                      onChange={(e) => { setRangeFrom(e.target.value); setRangeError(""); }}
                    >
                      <option value="">From</option>
                      {activeSlots.map((s) => <option key={s.id} value={s.display_label}>{s.display_label}</option>)}
                    </select>
                    <select
                      className="modal-select"
                      aria-label="To time"
                      value={rangeTo}
                      onChange={(e) => { setRangeTo(e.target.value); setRangeError(""); }}
                    >
                      <option value="">To</option>
                      {activeSlots.map((s) => <option key={s.id} value={s.display_label}>{s.display_label}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleBlockRange}
                      disabled={rangeLoading || !rangeFrom || !rangeTo}
                    >
                      {rangeLoading ? "Blocking…" : "Block range"}
                    </button>
                  </div>
                  {rangeError && <p className="avail-range-error">{rangeError}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
