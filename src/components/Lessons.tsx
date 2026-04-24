"use client";

import { useState } from "react";
import { LESSONS, LessonKey } from "@/lib/data";
import RevealWrapper from "./RevealWrapper";

const TABS: { key: LessonKey; label: string }[] = [
  { key: "beginner", label: "Foundations" },
  { key: "advanced", label: "Strategy" },
  { key: "clinic", label: "Clinic" },
];

export default function Lessons({
  onOpenBooking,
}: {
  onOpenBooking: (lessonType: LessonKey) => void;
}) {
  const [active, setActive] = useState<LessonKey>("beginner");
  const l = LESSONS[active];

  return (
    <section className="block" id="lessons">
      <RevealWrapper>
        <div className="kicker">Lesson Structure</div>
        <h2 className="section-title">
          Pick your <span className="italic">path.</span>
        </h2>
        <p className="section-sub">
          Every session is coached — not just timed court rental.
        </p>
      </RevealWrapper>
      <RevealWrapper delay={100}>
        <div className="lesson-tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`lesson-tab${active === key ? " active" : ""}`}
              onClick={() => setActive(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="lesson-card">
          <div className="lesson-head">
            <div>
              <h3>{l.name}</h3>
              <div className="desc">{l.desc}</div>
            </div>
            <div className="lesson-price">
              <div className="amt">{l.price}</div>
              <div className="per">{l.per}</div>
            </div>
          </div>
          <div className="lesson-steps">
            {l.steps.map((s) => (
              <div key={s.t} className="lesson-step">
                <div className="step-time">{s.t}</div>
                <div className="step-body">
                  <h5>{s.h}</h5>
                  <p>{s.p}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary lesson-book-btn"
            onClick={() => onOpenBooking(active)}
          >
            Book this lesson
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </RevealWrapper>
    </section>
  );
}
