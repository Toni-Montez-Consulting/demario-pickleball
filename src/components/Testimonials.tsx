"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { REVIEWS } from "@/lib/data";

interface TestimonialsProps {
  onOpenBooking: () => void;
}

const PROOF_POINTS = [
  {
    label: "Pattern reads",
    text: "Students learn why points are breaking down, not just which shot missed.",
  },
  {
    label: "Tournament prep",
    text: "Lesson plans can turn into match plans, opponent scouting, and pressure reps.",
  },
  {
    label: "At-home work",
    text: "Each session ends with simple priorities students can practice between lessons.",
  },
];

const REVIEW_WALL = [
  {
    quote: "Actually explains why, not just what. Game-changer.",
    name: "David L.",
    focus: "Shot selection",
  },
  {
    quote: "Patient, sharp, and fun. My wife and I both take lessons now.",
    name: "Carlos M.",
    focus: "Doubles lessons",
  },
  {
    quote: "First coach that made strategy feel doable at a 3.0 level.",
    name: "Priya S.",
    focus: "Beginner strategy",
  },
  {
    quote: "Showed up for my tournament to scout opponents. Unreal.",
    name: "Tom B.",
    focus: "Tournament support",
  },
];

const Stars = () => (
  <div className="stars">
    {[...Array(5)].map((_, i) => (
      <svg key={i} viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

function renderQuote(quote: string, accentWord: string | null) {
  if (!accentWord) return `"${quote}"`;
  const parts = quote.split(accentWord);
  return (
    <>
      &ldquo;{parts[0]}
      <span className="accent">{accentWord}</span>
      {parts[1]}&rdquo;
    </>
  );
}

export default function Testimonials({ onOpenBooking }: TestimonialsProps) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setIdx((prev) => (prev + 1) % REVIEWS.length);
      }
    }, 6000);
  }, []);

  function goReview(i: number) {
    setIdx(i);
    startTimer();
  }

  function pause() { pausedRef.current = true; }
  function resume() { pausedRef.current = false; }

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const r = REVIEWS[idx];

  return (
    <section className="block testimonials-section" id="testimonials">
      <div className="reveal in">
        <div className="kicker">Student Stories</div>
        <h2 className="section-title">
          Proof that goes
          <br />
          <span className="italic">beyond ratings.</span>
        </h2>
        <p className="section-sub">
          The strongest feedback is specific: clearer decisions, better practice, and more confidence when the point gets tight.
        </p>
      </div>
      <div
        className="reveal in reveal-d100 testimonials-layout"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={resume}
      >
        <div className="featured-review">
          <div className="review-tag">{r.tag}</div>
          <Stars />
          <p className="featured-quote">{renderQuote(r.quote, r.accentWord)}</p>
          <div className="review-author">
            <div className="avatar">{r.initial}</div>
            <div>
              <div className="author-name">{r.name}</div>
              <div className="author-meta">{r.meta}</div>
            </div>
          </div>
          <div className="review-takeaway">
            <span>Lesson impact</span>
            <strong>{r.takeaway}</strong>
          </div>
          <div className="review-pager">
            {REVIEWS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === idx ? "active" : ""}
                onClick={() => goReview(i)}
                aria-label={`Review ${i + 1}`}
              />
            ))}
          </div>
        </div>
        <div className="proof-panel">
          <div className="proof-panel-head">
            <span>What students remember</span>
            <strong>Clear coaching they can use in the next game.</strong>
          </div>
          <div className="proof-point-list">
            {PROOF_POINTS.map((point) => (
              <div className="proof-point" key={point.label}>
                <div className="proof-point-mark" aria-hidden="true">
                  <svg viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 5 4.5 8.5 11 1" />
                  </svg>
                </div>
                <div>
                  <h3>{point.label}</h3>
                  <p>{point.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="reveal in reveal-d150">
        <div className="small-reviews">
          {REVIEW_WALL.map((review) => (
            <div className="small-review" key={`${review.name}-${review.focus}`}>
              <div className="mini-review-head">
                <Stars />
                <span>{review.focus}</span>
              </div>
              <div>&ldquo;{review.quote}&rdquo;</div>
              <div className="name">— {review.name}</div>
            </div>
          ))}
        </div>
        <div className="testimonial-footer">
          <p>Student stories are shared with permission as players hit new goals.</p>
          <button type="button" className="btn btn-primary" onClick={onOpenBooking}>
            Start your own progress story
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
