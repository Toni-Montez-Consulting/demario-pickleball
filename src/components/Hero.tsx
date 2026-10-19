import Image from "next/image";
import RevealWrapper from "./RevealWrapper";
import { DUPR } from "@/lib/dupr";

interface HeroProps {
  onOpenBooking: () => void;
}

export default function Hero({ onOpenBooking }: HeroProps) {
  return (
    <section className="hero" id="hero">
      {/* Served through next/image so it gets avif/webp. As a CSS background it
          skipped the optimiser entirely, and it is the LCP candidate. Decorative,
          so alt is empty — the headline carries the meaning. Next 16 deprecated
          `priority`, which only preloads; its docs recommend eager loading plus
          fetchPriority="high" for the LCP image instead. The hero spans the
          page canvas: full width to 430px, then 900px, then 1100px. */}
      <div className="hero-bg">
        <Image
          src="/img/hero-ready.jpg"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1100px) 1100px, (min-width: 900px) 900px, (min-width: 768px) 100vw, (min-width: 430px) 430px, 100vw"
          className="hero-bg-img"
        />
      </div>
      <RevealWrapper>
        <div className="hero-content">
          <div className="eyebrow">
            <span className="dot" />
            Dallas–Fort Worth · Pickleball Coach
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
            <a className="btn btn-ghost" href="#lessons">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              See Lessons
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="num">
                {DUPR.doublesShort}<span className="unit">DUPR</span>
              </div>
              <div className="label">Doubles rating</div>
            </div>
            <div className="hero-stat">
              <div className="num">Top {DUPR.topPercent}%</div>
              <div className="label">DUPR worldwide</div>
            </div>
            <div className="hero-stat">
              <div className="num">
                600<span className="unit">+</span>
              </div>
              <div className="label">Students</div>
            </div>
          </div>
        </div>
      </RevealWrapper>
    </section>
  );
}
