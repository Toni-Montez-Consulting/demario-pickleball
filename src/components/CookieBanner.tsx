"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie_consent")) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("cookie_consent", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notice">
      <p className="cookie-text">
        Session cookies for admin login, plus cookieless page-view analytics. No advertising, no cross-site tracking.{" "}
        <a href="/privacy">Privacy Policy</a>
      </p>
      <button type="button" className="btn btn-primary cookie-btn" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
