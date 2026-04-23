import RevealWrapper from "./RevealWrapper";

interface HeroProps {
  onOpenBooking: () => void;
}

export default function Hero({ onOpenBooking }: HeroProps) {
  return (
    <section className="hero" id="hero">
      <div
        className="hero-bg"
        style={{ backgroundImage: "url('/img/hero-ready.jpg')" }}
      />
      <RevealWrapper>
        <div className="hero-content">
          <div className="eyebrow">
            <span className="dot" />
            Dallas–Fort Worth · Head Pro
          </div>
          <h1 className="hero-title">
            Train smarter.
            <br />
            Compete <span className="italic">better.</span>
          </h1>
          <p className="hero-sub">
            Strategic 1:1 pickleball coaching built around how you actually
            play — so you stop guessing and start winning.
          </p>
          <div className="cta-row">
            <button className="btn btn-primary" onClick={onOpenBooking}>
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
            <a className="btn btn-ghost" href="#testimonials">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ width: 14, height: 14 }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="num">
                4.6<span className="unit">DUPR</span>
              </div>
              <div className="label">Sngl &amp; Dbl DUPR</div>
            </div>
            <div className="hero-stat">
              <div className="num">
                5.0<span className="unit">★</span>
              </div>
              <div className="label">79 reviews</div>
            </div>
            <div className="hero-stat">
              <div className="num">Top 3%</div>
              <div className="label">SuperCoach</div>
            </div>
          </div>
        </div>
      </RevealWrapper>
    </section>
  );
}
