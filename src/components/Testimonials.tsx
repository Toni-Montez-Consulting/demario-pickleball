"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface TestimonialsProps {
  onOpenBooking: () => void;
}

interface PublishedReview {
  id: string;
  rating: number;
  body: string | null;
  display_name: string;
  lesson_context: string | null;
  tag: string | null;
  takeaway: string | null;
  verified_booking: boolean;
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

const Stars = ({ count = 5 }: { count?: number }) => (
  <div className="stars">
    {[...Array(count)].map((_, i) => (
      <svg key={i} viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

export default function Testimonials({ onOpenBooking }: TestimonialsProps) {
  const [reviews, setReviews] = useState<PublishedReview[]>([]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reviews/published")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PublishedReview[]) => {
        if (!cancelled) setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A takeaway is Mario's signal that a review belongs in the featured slot.
  // If he has published reviews but labelled none of them, fall back to showing
  // the most recent rather than leaving half the layout empty.
  const { featured, wall } = useMemo(() => {
    const labelled = reviews.filter((r) => r.takeaway);
    const feat = labelled.length > 0 ? labelled : reviews.slice(0, 1);
    const featIds = new Set(feat.map((r) => r.id));
    return { featured: feat, wall: reviews.filter((r) => !featIds.has(r.id)) };
  }, [reviews]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (featured.length < 2) return;
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setIdx((prev) => (prev + 1) % featured.length);
      }
    }, 6000);
  }, [featured.length]);

  function goReview(i: number) {
    setIdx(i);
    startTimer();
  }

  function pause() {
    pausedRef.current = true;
  }
  function resume() {
    pausedRef.current = false;
  }

  useEffect(() => {
    setIdx(0);
  }, [featured.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const r = featured[idx] ?? null;

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
        {r && (
          <div className="featured-review">
            {r.tag && <div className="review-tag">{r.tag}</div>}
            <Stars count={r.rating} />
            <p className="featured-quote">&ldquo;{r.body}&rdquo;</p>
            <div className="review-author">
              <div className="avatar">{r.display_name.trim().charAt(0).toUpperCase()}</div>
              <div>
                <div className="author-name">{r.display_name}</div>
                {r.lesson_context && <div className="author-meta">{r.lesson_context}</div>}
              </div>
            </div>
            {r.takeaway && (
              <div className="review-takeaway">
                <span>Lesson impact</span>
                <strong>{r.takeaway}</strong>
              </div>
            )}
            {featured.length > 1 && (
              <div className="review-pager">
                {featured.map((review, i) => (
                  <button
                    key={review.id}
                    type="button"
                    className={i === idx ? "active" : ""}
                    onClick={() => goReview(i)}
                    aria-label={`Review ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
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
        {wall.length > 0 && (
          <div className="small-reviews">
            {wall.map((review) => (
              <div className="small-review" key={review.id}>
                <div className="mini-review-head">
                  <Stars count={review.rating} />
                  {review.lesson_context && <span>{review.lesson_context}</span>}
                </div>
                <div>&ldquo;{review.body}&rdquo;</div>
                <div className="name">— {review.display_name}</div>
              </div>
            ))}
          </div>
        )}
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
