import { TEACHMETO_REVIEWS_URL } from "@/lib/business";

const StarIcon = () => (
  <svg
    className="ico"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const ExternalIcon = () => (
  <svg
    className="ext"
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

export default function TrustBar() {
  return (
    <div className="trust">
      <div className="trust-marquee">
        {/* Counts checked against the listing in October 2026. "137+" stays true
            as ratings accumulate; update it if the 5.0 average ever moves. */}
        <a
          className="trust-chip rating"
          href={TEACHMETO_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="var(--accent)"
            stroke="none"
            aria-hidden="true"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>
            <strong>5.0</strong> · 137+ ratings on TeachMe.To
            <span className="sr-only"> (opens in a new tab)</span>
          </span>
          <ExternalIcon />
        </a>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>SuperCoach</strong> · Top 3% · TeachMe.To
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>USPTA</strong> · Certified Coach
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>DUPR</strong> · 4.97 Doubles
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>Top 40</strong> · DFW Metroplex
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>Top 100</strong> · Texas DUPR
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>Dallas ISD</strong> · Pickleball Instructor
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>City of Carrollton</strong> · Pickleball Instructor
          </span>
        </div>
        <div className="trust-chip rating">
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>
            <strong>600+</strong> · Students coached
          </span>
        </div>
      </div>
    </div>
  );
}
