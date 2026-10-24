"use client";

import { useState, useEffect } from "react";
import { readLocalSetting, saveLocalSetting } from "@/lib/local-settings";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Blocked storage reads as "not dismissed yet", so the notice still shows.
    if (!readLocalSetting("cookie_consent")) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    saveLocalSetting("cookie_consent", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie notice">
      <p className="cookie-text">
        Session cookies for admin login, plus cookieless analytics: page views and anonymous
        button taps. No advertising, no cross-site tracking.{" "}
        <a href="/privacy">Privacy Policy</a>
      </p>
      <button type="button" className="btn btn-primary cookie-btn" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
