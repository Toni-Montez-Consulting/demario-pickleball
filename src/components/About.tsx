import Image from "next/image";
import RevealWrapper from "./RevealWrapper";
import { DUPR } from "@/lib/dupr";

// Widths measured from the page canvas (full width to 430px, 900px from 768px,
// 1100px from 1100px) minus section padding (22 / 48 / 64px a side). The old
// values assumed the 430px phone canvas everywhere, so desktop got a 640w file
// stretched to 972px.
const FULL_WIDTH =
  "(min-width: 1100px) 972px, (min-width: 900px) 804px, (min-width: 768px) calc(100vw - 96px), (min-width: 430px) 386px, calc(100vw - 44px)";
const ACHIEVEMENT_PHOTO =
  "(min-width: 1100px) 440px, (min-width: 900px) 360px, (min-width: 768px) calc(47vw - 60px), (min-width: 430px) 360px, calc(100vw - 70px)";
const GALLERY_TALL =
  "(min-width: 1100px) 641px, (min-width: 900px) 531px, (min-width: 768px) calc(66vw - 70px), (min-width: 430px) 252px, calc(66vw - 35px)";
const GALLERY_CELL =
  "(min-width: 1100px) 320px, (min-width: 900px) 265px, (min-width: 768px) calc(33vw - 35px), (min-width: 430px) 126px, calc(33vw - 18px)";

export default function About() {
  return (
    <section className="block about" id="about">
      <RevealWrapper>
        <div className="kicker">About the Coach</div>
        <h2 className="section-title">
          DeMario <span className="italic">Montez.</span>
        </h2>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <div className="about-img">
          <Image
            src="/img/podium-solo.jpg"
            alt="DeMario Montez on the pickleball court"
            fill
            className="gallery-img"
            sizes={FULL_WIDTH}
          />
          <div className="about-badge">
            <div className="mini-badge">
              <span className="dot" />
              Pickleball Coach
            </div>
            <div className="mini-badge">Farmers Branch, TX</div>
          </div>
        </div>
      </RevealWrapper>
      <RevealWrapper delay={120}>
        <p className="about-bio-intro">
          I&apos;m a {DUPR.doublesShort} doubles DUPR player — top{" "}
          {DUPR.topPercent}% worldwide and in Texas, top {DUPR.texasTop} in the
          state, and top {DUPR.dfwTop} in DFW. I&apos;m also a
          USPTA/DUPR certified coach and a pickleball instructor for Dallas ISD
          and the City of Carrollton. I built my game the hard way — film study,
          repeatable patterns, pressure-testing every shot. Now I build yours
          the same way.
        </p>
        <p className="about-bio-sub">
          I&apos;ll meet you at your level, diagnose the three things holding you
          back, and give you a plan you can actually execute — on the court and
          in your head.
        </p>
        <div className="about-stats">
          <div className="about-stat">
            <div className="num">{DUPR.doubles}</div>
            <div className="label">Doubles DUPR</div>
          </div>
          <div className="about-stat">
            <div className="num">Top {DUPR.dfwTop}</div>
            <div className="label">DFW players</div>
          </div>
          <div className="about-stat">
            <div className="num">25+</div>
            <div className="label">Lessons a Week</div>
          </div>
          <div className="about-stat">
            <div className="num">12</div>
            <div className="label">Tournament Podiums</div>
          </div>
        </div>
        {/* Ratings move every week and are updated by hand until DUPR grants API
            access. The date keeps the claim honest once it starts to age. */}
        <p className="about-stats-note">
          DUPR doubles rating and rankings as of {DUPR.asOf}.
        </p>
      </RevealWrapper>
      <RevealWrapper delay={150}>
        <div className="achievement-card">
          <div className="achievement-photo">
            <Image
              src="/img/crazy-ape-dill-dinkers-podium.jpg"
              alt="DeMario Montez after winning the Crazy Ape Dill Dinkers Plano pickleball tournament"
              fill
              className="gallery-img"
              sizes={ACHIEVEMENT_PHOTO}
            />
          </div>
          <div className="achievement-copy">
            <div className="kicker">Recent Win</div>
            <h3>Crazy Ape x Dill Dinkers Champion</h3>
            <p>
              DeMario took first in the 4.5-5.0 DUPR division at the Crazy Ape
              x Dill Dinkers Plano tournament and finished the run undefeated.
            </p>
            <div className="achievement-meta">
              <span>First place</span>
              <span>Dill Dinkers Plano</span>
              <span>April 2026</span>
            </div>
          </div>
        </div>
      </RevealWrapper>
      <RevealWrapper delay={180}>
        <div className="about-gallery-header">
          <div className="kicker">On the Court</div>
        </div>
        <div className="gallery">
          <div className="gallery-item tall">
            <Image
              src="/img/students-group.jpg"
              alt="Students group photo"
              fill
              className="gallery-img"
              sizes={GALLERY_TALL}
            />
          </div>
          <div className="gallery-item">
            <Image
              src="/img/student-selfie.jpg"
              alt="Student selfie with coach"
              fill
              className="gallery-img"
              sizes={GALLERY_CELL}
            />
          </div>
          <div className="gallery-item">
            <Image
              src="/img/doubles-medal.jpg"
              alt="Doubles tournament medal"
              fill
              className="gallery-img"
              sizes={GALLERY_CELL}
            />
          </div>
          <div className="gallery-item wide">
            <Image
              src="/img/podium-team.jpg"
              alt="Podium team photo"
              fill
              className="gallery-img"
              sizes={FULL_WIDTH}
            />
          </div>
        </div>
      </RevealWrapper>
    </section>
  );
}
