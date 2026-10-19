import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders, type SecurityHeaderOptions } from "./security-headers";

const PRODUCTION: SecurityHeaderOptions = {
  supabaseUrl: "https://abc123.supabase.co",
  isDev: false,
  isPreview: false,
};

function directive(policy: string, name: string): string[] {
  const found = policy.split("; ").find((part) => part.startsWith(`${name} `));
  if (!found) throw new Error(`missing ${name}`);
  return found.split(" ").slice(1);
}

describe("buildContentSecurityPolicy", () => {
  it("allows browser calls to this site and Supabase only, in production", () => {
    expect(directive(buildContentSecurityPolicy(PRODUCTION), "connect-src")).toEqual([
      "'self'",
      "https://abc123.supabase.co",
    ]);
  });

  it("denies framing, plugins, base rewrites, and form posts elsewhere", () => {
    const policy = buildContentSecurityPolicy(PRODUCTION);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "frame-src")).toEqual(["'none'"]);
  });

  it("keeps eval, the dev analytics script, and websockets out of production", () => {
    const policy = buildContentSecurityPolicy(PRODUCTION);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("va.vercel-scripts.com");
    expect(policy).not.toContain("ws:");
    expect(policy).not.toContain("vercel.live");
  });

  it("adds what next dev needs only in development", () => {
    const policy = buildContentSecurityPolicy({ ...PRODUCTION, isDev: true });
    expect(directive(policy, "script-src")).toEqual(
      expect.arrayContaining(["'unsafe-eval'", "https://va.vercel-scripts.com"])
    );
    expect(directive(policy, "connect-src")).toContain("ws:");
  });

  it("adds the Vercel Toolbar's documented sources only on previews", () => {
    const policy = buildContentSecurityPolicy({ ...PRODUCTION, isPreview: true });
    expect(directive(policy, "script-src")).toContain("https://vercel.live");
    expect(directive(policy, "connect-src")).toEqual(
      expect.arrayContaining(["https://vercel.live", "wss://ws-us3.pusher.com"])
    );
    expect(directive(policy, "frame-src")).toEqual(["https://vercel.live"]);
    expect(directive(policy, "font-src")).toEqual(
      expect.arrayContaining(["https://vercel.live", "https://assets.vercel.com"])
    );
  });

  it("allows the Sentry host from the DSN without its key", () => {
    const policy = buildContentSecurityPolicy({
      ...PRODUCTION,
      sentryDsn: "https://publickey@o123.ingest.us.sentry.io/456",
    });
    expect(directive(policy, "connect-src")).toContain("https://o123.ingest.us.sentry.io");
    expect(policy).not.toContain("publickey");
  });

  it("trims the Supabase URL the way Vercel env values sometimes arrive", () => {
    const policy = buildContentSecurityPolicy({ ...PRODUCTION, supabaseUrl: " https://abc123.supabase.co/\n" });
    expect(directive(policy, "connect-src")).toContain("https://abc123.supabase.co");
  });

  it("fails loudly instead of shipping a policy that would block admin login", () => {
    expect(() => buildContentSecurityPolicy({ ...PRODUCTION, supabaseUrl: undefined })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => buildContentSecurityPolicy({ ...PRODUCTION, supabaseUrl: "not a url" })).toThrow(/not a valid URL/);
  });
});

describe("buildSecurityHeaders", () => {
  it("sends HSTS with includeSubDomains and keeps the earlier headers", () => {
    const headers = Object.fromEntries(buildSecurityHeaders(PRODUCTION).map(({ key, value }) => [key, value]));
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
  });
});
