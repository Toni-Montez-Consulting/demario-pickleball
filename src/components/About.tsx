import Image from "next/image";
import RevealWrapper from "./RevealWrapper";

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
            sizes="(max-width: 430px) 100vw, 430px"
            priority
          />
          <div className="about-badge">
            <div className="mini-badge">
              <span className="dot" />
              Head Pro
            </div>
            <div className="mini-badge">Farmers Branch, TX</div>
          </div>
        </div>
      </RevealWrapper>
      <RevealWrapper delay={120}>
        <p className="about-bio-intro">
          I&apos;m a 4.6 DUPR player, USTA/DUPR certified coach, and Head Pro
          at Dallas Indoor Pickleball Club. I built my game the hard way — film
          study, repeatable patterns, pressure-testing every shot. Now I build
          yours the same way.
        </p>
        <p className="about-bio-sub">
          I&apos;ll meet you at your level, diagnose the three things holding you
          back, and give you a plan you can actually execute — on the court and
          in your head.
        </p>
        <div className="about-stats">
          <div className="about-stat">
            <div className="num">4.612</div>
            <div className="label">Doubles DUPR</div>
          </div>
          <div className="about-stat">
            <div className="num">4.629</div>
            <div className="label">Singles DUPR</div>
          </div>
          <div className="about-stat">
            <div className="num">500+</div>
            <div className="label">Lessons Taught</div>
          </div>
          <div className="about-stat">
            <div className="num">12</div>
            <div className="label">Tournament Podiums</div>
          </div>
        </div>
      </RevealWrapper>
      <RevealWrapper delay={150}>
        <div className="achievement-card">
          <div className="achievement-photo">
            <Image
              src="/img/crazy-ape-dill-dinkers-podium.jpg"
              alt="DeMario Montez after winning the Crazy Ape Dill Dinkers Plano pickleball tournament"
              fill
              className="gallery-img"
              sizes="(max-width: 430px) 100vw, 430px"
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
              sizes="(max-width: 430px) 60vw, 300px"
            />
          </div>
          <div className="gallery-item">
            <Image
              src="/img/student-selfie.jpg"
              alt="Student selfie with coach"
              fill
              className="gallery-img"
              sizes="(max-width: 430px) 40vw, 200px"
            />
          </div>
          <div className="gallery-item">
            <Image
              src="/img/doubles-medal.jpg"
              alt="Doubles tournament medal"
              fill
              className="gallery-img"
              sizes="(max-width: 430px) 40vw, 200px"
            />
          </div>
          <div className="gallery-item wide">
            <Image
              src="/img/podium-team.jpg"
              alt="Podium team photo"
              fill
              className="gallery-img"
              sizes="(max-width: 430px) 100vw, 500px"
            />
          </div>
        </div>
      </RevealWrapper>
    </section>
  );
}
