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

export default function TrustBar() {
  return (
    <div className="trust">
      <div className="trust-marquee">
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>SuperCoach</strong> · Top 3% · TeachMe.To
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>USTA</strong> · Certified Coach
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>DUPR</strong> · 4.70 Dbl · 4.58 Sngl
          </span>
        </div>
        <div className="trust-chip">
          <StarIcon />
          <span>
            <strong>Dallas Indoor</strong> · Head Pro
          </span>
        </div>
        <div className="trust-chip rating">
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="var(--accent)"
            stroke="none"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>
            <strong>5.0 ★</strong> · 79 reviews
          </span>
        </div>
      </div>
    </div>
  );
}
