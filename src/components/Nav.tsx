export default function Nav() {
  return (
    <nav className="topnav">
      <div className="brand">
        <div className="brand-mark">D</div>
        <span>
          DeMario<span className="brand-muted"> / Coach</span>
        </span>
      </div>
      <button type="button" className="menu-btn" aria-label="Menu">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
    </nav>
  );
}
