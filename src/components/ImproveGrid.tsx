import RevealWrapper from "./RevealWrapper";

export default function ImproveGrid() {
  return (
    <section className="block block-alt">
      <RevealWrapper>
        <div className="kicker">What You&apos;ll Improve</div>
        <h2 className="section-title">
          Four weak spots.
          <br />
          <span className="italic">Fixed with a plan.</span>
        </h2>
        <p className="section-sub">
          Every lesson targets one — never a random bucket drill.
        </p>
      </RevealWrapper>
      <div className="improve-list">
        <RevealWrapper delay={0}>
          <div className="improve-card">
            <div className="improve-ico">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 014.44-1.04z" />
                <path d="M14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-4.44-1.04z" />
              </svg>
            </div>
            <div>
              <h3>Strategy &amp; Decision-Making</h3>
              <p>Read the court. Pick the right shot. Every time.</p>
            </div>
          </div>
        </RevealWrapper>
        <RevealWrapper delay={80}>
          <div className="improve-card">
            <div className="improve-ico">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h3>Shot Consistency</h3>
              <p>Dinks, drives, drops — rehearsed until automatic.</p>
            </div>
          </div>
        </RevealWrapper>
        <RevealWrapper delay={160}>
          <div className="improve-card">
            <div className="improve-ico">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 12h18M12 3v18" />
              </svg>
            </div>
            <div>
              <h3>Court Positioning</h3>
              <p>Own the kitchen line. Control the point before it starts.</p>
            </div>
          </div>
        </RevealWrapper>
        <RevealWrapper delay={240}>
          <div className="improve-card">
            <div className="improve-ico">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h3>Confidence Under Pressure</h3>
              <p>Train the mental game so tournament nerves vanish.</p>
            </div>
          </div>
        </RevealWrapper>
      </div>
    </section>
  );
}
