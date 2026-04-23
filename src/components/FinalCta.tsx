import RevealWrapper from "./RevealWrapper";

interface FinalCtaProps {
  onOpenBooking: () => void;
}

export default function FinalCta({ onOpenBooking }: FinalCtaProps) {
  return (
    <section className="final-cta">
      <RevealWrapper>
        <h2 className="final-title">
          Start improving <span className="italic">today.</span>
        </h2>
        <p className="final-sub">
          First lesson is a plan, not a pitch. You&apos;ll leave with three
          things to practice.
        </p>
        <div className="cta-inline">
          <button className="btn btn-primary" onClick={onOpenBooking}>
            Book your first lesson
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
        <div className="meta-line">
          <span>
            <span className="mdot" />
            60 min
          </span>
          <span>
            <span className="mdot" />
            From $70
          </span>
          <span>
            <span className="mdot" />
            Dallas, TX
          </span>
        </div>
      </RevealWrapper>
    </section>
  );
}
