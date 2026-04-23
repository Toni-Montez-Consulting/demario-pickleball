import RevealWrapper from "./RevealWrapper";

export default function About() {
  return (
    <section className="block about">
      <RevealWrapper>
        <div className="kicker">About the Coach</div>
        <h2 className="section-title">
          DeMario <span className="italic">Montez.</span>
        </h2>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        <div
          className="about-img"
          style={{ backgroundImage: "url('/img/podium-solo.jpg')" }}
        >
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
      <RevealWrapper delay={180}>
        <div className="about-gallery-header">
          <div className="kicker">On the Court</div>
        </div>
        <div className="gallery">
          <div
            className="tall"
            style={{ backgroundImage: "url('/img/students-group.jpg')" }}
            role="img"
            aria-label="Students group photo"
          />
          <div
            style={{ backgroundImage: "url('/img/student-selfie.jpg')" }}
            role="img"
            aria-label="Student selfie"
          />
          <div
            style={{ backgroundImage: "url('/img/doubles-medal.jpg')" }}
            role="img"
            aria-label="Doubles medal"
          />
          <div
            className="wide"
            style={{ backgroundImage: "url('/img/podium-team.jpg')" }}
            role="img"
            aria-label="Podium team photo"
          />
        </div>
      </RevealWrapper>
    </section>
  );
}
