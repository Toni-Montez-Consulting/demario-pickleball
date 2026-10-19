"use client";

import { useState, useEffect } from "react";
import { eventAttributes } from "@/lib/analytics";

interface StickyCtaProps {
  onOpenBooking: () => void;
}

export default function StickyCta({ onOpenBooking }: StickyCtaProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const handler = () => setShown(window.scrollY > 500);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Hidden near the top of the page, where it is only transparent. inert takes
  // its controls out of the tab order and the accessibility tree until it
  // shows, so focus never lands on an invisible button.
  return (
    <div
      className={`sticky-cta${shown ? " shown" : ""}`}
      role="region"
      aria-label="Book or call DeMario"
      inert={!shown}
    >
      <button type="button" className="book" onClick={onOpenBooking}>
        Book a lesson
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
      <a
        className="phone"
        href="tel:4693719220"
        aria-label="Call DeMario"
        {...eventAttributes("contact_click", { channel: "tel", surface: "sticky" })}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
        </svg>
      </a>
    </div>
  );
}
