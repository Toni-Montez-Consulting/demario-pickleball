"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";

interface EnrollData {
  factorId: string;
  qrCodeDataUrl: string;
  secret: string;
}

export default function MfaSetupPage() {
  const router = useRouter();
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverified = factors?.totp?.find((f) => f.status !== "verified");
      if (unverified) {
        await supabase.auth.mfa.unenroll({ factorId: unverified.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "DeMario Pickleball",
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Could not start MFA enrollment.");
        setLoading(false);
        return;
      }

      const otpauthUri = data.totp.uri;
      const dataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });
      setEnroll({
        factorId: data.id,
        qrCodeDataUrl: dataUrl,
        secret: data.totp.secret,
      });
      setLoading(false);
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (enroll) codeInputRef.current?.focus();
  }, [enroll]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setError("");
    setVerifying(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enroll.factorId,
    });
    if (challengeError || !challenge) {
      setVerifying(false);
      setError(challengeError?.message ?? "Could not start verification.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      setCode("");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card mfa-setup-card">
        <div className="brand-mark">D</div>
        <h1>Set up 2-factor auth</h1>
        <p className="mfa-intro">This is a one-time setup. You&apos;ll need an authenticator app on your phone.</p>

        <ol className="mfa-steps">
          <li>
            <strong>Download an authenticator app</strong> if you don&apos;t have one:
            <div className="mfa-app-links">
              <a href="https://apps.apple.com/us/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer">Google Authenticator (iPhone)</a>
              <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer">Google Authenticator (Android)</a>
            </div>
          </li>
          <li><strong>Open the app</strong>, tap the <strong>+</strong> button, then tap <strong>Scan a QR code</strong>.</li>
          <li><strong>Scan the QR code</strong> below with your phone&apos;s camera.</li>
          <li>The app will show a <strong>6-digit code</strong>. Type it in the box below and tap <strong>Verify &amp; finish</strong>.</li>
        </ol>

        {loading && <p className="admin-empty">Preparing QR code…</p>}

        {enroll && (
          <>
            <div className="mfa-qr-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qrCodeDataUrl} alt="Scan this QR code with your authenticator app" width={220} height={220} />
            </div>
            <details className="mfa-secret-details">
              <summary>Can&apos;t scan the QR code? Enter this secret manually instead</summary>
              <p className="mfa-secret-note">In your app, choose <strong>Enter setup key</strong>, then paste this code:</p>
              <code className="mfa-secret">{enroll.secret}</code>
            </details>

            <form onSubmit={handleVerify}>
              <div className="modal-form-group">
                <label htmlFor="mfa-setup-code">6-digit code</label>
                <input
                  id="mfa-setup-code"
                  ref={codeInputRef}
                  className="modal-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              {error && <div className="modal-error">{error}</div>}
              <button type="submit" className="btn btn-primary btn-full" disabled={verifying || code.length !== 6}>
                {verifying ? "Verifying…" : "Verify & finish"}
              </button>
            </form>
          </>
        )}

        {error && !enroll && <div className="modal-error">{error}</div>}
      </div>
    </div>
  );
}
