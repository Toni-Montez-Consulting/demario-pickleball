"use client";

import { useState } from "react";
import RevealWrapper from "./RevealWrapper";

type Status = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setName("");
    setEmail("");
    setMessage("");
    setCompany("");
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, company }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Try again.");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <section className="contact-section" id="contact">
      <RevealWrapper>
        <div className="kicker">Get in Touch</div>
        <h2 className="section-title">
          Have a <span className="italic">question?</span>
        </h2>
        <p className="section-sub">
          Ask about lesson availability, group rates, or anything else — I read every message.
        </p>
      </RevealWrapper>
      <RevealWrapper delay={80}>
        {status === "success" ? (
          <div className="contact-success">
            <div className="confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h4>Message sent.</h4>
            <p>I&apos;ll get back to you within 24 hours.</p>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Send another message
            </button>
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="modal-form-group">
              <label htmlFor="cf-name">Your name</label>
              <input
                id="cf-name"
                className="modal-input"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="cf-email">Email</label>
              <input
                id="cf-email"
                className="modal-input"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                spellCheck={false}
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="cf-message">Message</label>
              <textarea
                id="cf-message"
                className="modal-input"
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={2000}
                rows={5}
              />
              <div className={`char-count${message.length >= 1800 ? " char-warn" : ""}`}>{message.length} / 2000</div>
            </div>
            <div className="honeypot-field" aria-hidden="true">
              <label htmlFor="cf-company">Company</label>
              <input
                id="cf-company"
                type="text"
                name="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </div>
            {status === "error" && (
              <div className="modal-error">{errorMsg}</div>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Sending…" : "Send message"}
              {status !== "loading" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>
        )}
      </RevealWrapper>
    </section>
  );
}
