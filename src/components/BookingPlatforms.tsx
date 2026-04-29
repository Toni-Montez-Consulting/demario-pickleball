import RevealWrapper from "./RevealWrapper";
import { REQUIRED_BOOKING_PATHS } from "@/lib/venue-rules";

const ExternalIcon = () => (
  <svg
    className="bp-arrow"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 17L17 7M7 7h10v10" />
  </svg>
);

const PhoneIcon = () => (
  <svg
    className="bp-arrow"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" />
  </svg>
);

export default function BookingPlatforms() {
  return (
    <section className="book-platforms">
      <RevealWrapper>
        <div className="bp-header">
          <div className="eyebrow">Choose Your Path</div>
          <p className="bp-sub">
            Public-court lessons can be scheduled here. Some clubs and coaching
            platforms require their own reservation, payment, and waiver flow.
          </p>
        </div>
        <div className="bp-list">
          {REQUIRED_BOOKING_PATHS.map((p) => {
            const content = (
              <>
                <div className="bp-card-text">
                  <div className="bp-name">{p.name}</div>
                  <div className="bp-desc">{p.summary}</div>
                </div>
                {p.href ? <ExternalIcon /> : <span className="bp-tag">By request</span>}
              </>
            );

            return p.href ? (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bp-card"
              >
                {content}
              </a>
            ) : (
              <div key={p.name} className="bp-card bp-card-static">
                {content}
              </div>
            );
          })}
          <a href="sms:4693719220" className="bp-card bp-card-phone">
            <div className="bp-card-text">
              <div className="bp-name">Text or Call</div>
              <div className="bp-desc">
                Not sure which route applies? Text{" "}
                <strong>(469) 371-9220</strong> to check availability or ask
                questions.
              </div>
            </div>
            <PhoneIcon />
          </a>
        </div>
      </RevealWrapper>
    </section>
  );
}
