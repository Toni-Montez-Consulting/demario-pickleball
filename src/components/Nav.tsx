"use client";

import { useState, useEffect } from "react";

interface NavProps {
  onOpenBooking: () => void;
}

export default function Nav({ onOpenBooking }: NavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function handleBooking() {
    setOpen(false);
    onOpenBooking();
  }

  return (
    <>
      <nav className="topnav">
        <div className="brand">
          <div className="brand-mark">D</div>
          <span>DeMario<span className="brand-muted"> / Coach</span></span>
        </div>
        <button
          type="button"
          className="menu-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open ? "true" : "false"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <div className="nav-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <div className={`nav-drawer${open ? " open" : ""}`} aria-hidden={open ? "false" : "true"}>
        <a className="nav-link" href="#lessons" onClick={() => setOpen(false)}>Lessons</a>
        <a className="nav-link" href="#about" onClick={() => setOpen(false)}>About</a>
        <a className="nav-link" href="#contact" onClick={() => setOpen(false)}>Contact</a>
        <button type="button" className="btn btn-primary nav-book-btn" onClick={handleBooking}>
          Book a lesson
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </>
  );
}
