"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = "credentials" | "mfa";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(searchParams.get("error") ?? "");
  const [loading, setLoading] = useState(false);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "mfa") mfaInputRef.current?.focus();
  }, [stage]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setLoading(false);
      setError("Could not check MFA status. Try again.");
      return;
    }

    if (aal?.currentLevel === "aal2" || aal?.nextLevel === "aal1") {
      setLoading(false);
      router.push("/admin");
      router.refresh();
      return;
    }

    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) {
      setLoading(false);
      setError(factorError.message);
      return;
    }

    const verified = factors?.totp?.find((f) => f.status === "verified");
    if (!verified) {
      setLoading(false);
      router.push("/admin/mfa-setup");
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: verified.id,
    });
    setLoading(false);
    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Could not start MFA challenge.");
      return;
    }
    setFactorId(verified.id);
    setChallengeId(challenge.id);
    setStage("mfa");
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    setLoading(false);
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
      <div className="admin-login-card">
        <div className="brand-mark">D</div>
        <h1>Coach Login</h1>
        <p>{stage === "credentials" ? "Sign in to manage bookings and inquiries." : "Enter the 6-digit code from your authenticator app."}</p>
        {stage === "credentials" ? (
          <form onSubmit={handleCredentials}>
            <div className="modal-form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="modal-input"
                type="email"
                placeholder="coach@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="modal-form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="modal-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="modal-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfa}>
            <div className="modal-form-group">
              <label htmlFor="login-mfa">Authenticator code</label>
              <input
                id="login-mfa"
                ref={mfaInputRef}
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
            <button type="submit" className="btn btn-primary btn-full" disabled={loading || code.length !== 6}>
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
