"use client";

import { useState } from "react";
import { LESSONS, LessonKey } from "@/lib/data";
import { GROUP_SIZE_LIMITS, quoteSession, usd, type SessionFormat } from "@/lib/session-pricing";
import RevealWrapper from "./RevealWrapper";

const TABS: { key: LessonKey; label: string }[] = [
  { key: "beginner", label: "Foundations" },
  { key: "advanced", label: "Strategy" },
  { key: "clinic", label: "Clinic" },
  { key: "drill", label: "Drilling" },
  { key: "play_pro", label: "Play with the Pro" },
];

/** Every group size's price, read from DeMario's table rather than written into copy. */
function PriceTable({ format }: { format: SessionFormat }) {
  const { min, max } = GROUP_SIZE_LIMITS[format];
  const sizes = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const columns = format === "drill" ? ["60 min", "90 min"] : ["Per player", "Total"];
  const cells = (size: number) =>
    format === "drill"
      ? [quoteSession("drill", size, 60).perPerson, quoteSession("drill", size, 90).perPerson]
      : [quoteSession("play_pro", size).perPerson, quoteSession("play_pro", size).total];

  return (
    <div className="lesson-prices">
      <table className="price-table">
        <caption>{format === "drill" ? "Price per player" : "Price per player and total"}</caption>
        <thead>
          <tr>
            <th scope="col">Players</th>
            {columns.map((column) => (
              <th key={column} scope="col">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((size) => (
            <tr key={size}>
              <th scope="row">{size}</th>
              {cells(size).map((dollars, i) => (
                <td key={columns[i]}>{usd(dollars)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="price-note">Court fees, if any, are separate.</p>
    </div>
  );
}

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
              {l.from && <div className="from">{l.from}</div>}
            </div>
          </div>
          {l.priceTable ? (
            <PriceTable format={l.priceTable} />
          ) : (
            <div className="lesson-steps">
              {l.steps?.map((s) => (
                <div key={s.t} className="lesson-step">
                  <div className="step-time">{s.t}</div>
                  <div className="step-body">
                    <h4>{s.h}</h4>
                    <p>{s.p}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
