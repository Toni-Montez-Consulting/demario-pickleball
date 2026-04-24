export default function Footer() {
  return (
    <footer>
      <div className="fwrap">
        <div>DeMario Montez · Pickleball Coach</div>
        <div>© 2026</div>
      </div>
      <div className="contact-line">
        <a href="mailto:demariomontez10@gmail.com">demariomontez10@gmail.com</a>
        {" · "}
        <a href="tel:4693719220">(469) 371-9220</a>
        {" · "}
        Dallas, TX
      </div>
      <div className="footer-social">
        <a
          href="https://instagram.com/Alexanderiio"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="social-link"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a
          href="https://tiktok.com/@DemarioMontez"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TikTok"
          className="social-link"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.36 6.36 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z" />
          </svg>
        </a>
        <a
          href="https://facebook.com/DemarioMontez"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className="social-link"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        </a>
      </div>
      <div className="footer-legal">
        <a href="/pay">Pay DeMario</a>
        <span className="legal-sep">·</span>
        <a href="/privacy">Privacy Policy</a>
        <span className="legal-sep">·</span>
        <a href="/terms">Terms of Service</a>
      </div>
    </footer>
  );
}
