/**
 * Response security headers for every route, applied in next.config.ts.
 *
 * The Content Security Policy keeps pages static. Next's App Router writes page
 * data as inline scripts, so script-src allows 'unsafe-inline' rather than
 * per-request nonces: nonces would force every page to render on demand and
 * give up the CDN cache the homepage is served from. What the policy still
 * enforces: scripts, styles, fonts, and images only from this site; network
 * calls only to this site, Supabase, and Sentry when it is configured; and no
 * framing, plugins, <base> rewrites, or form posts to other sites.
 */

export type SecurityHeaderOptions = {
  /** NEXT_PUBLIC_SUPABASE_URL. Admin login and MFA call it from the browser. */
  supabaseUrl: string | undefined;
  /** NEXT_PUBLIC_SENTRY_DSN. When set, the browser SDK reports to its host. */
  sentryDsn?: string;
  /** `next dev`: React needs eval, hot reload uses a websocket, and the analytics debug script loads. */
  isDev: boolean;
  /** Vercel preview builds load the Vercel Toolbar for comments. */
  isPreview: boolean;
};

export type SecurityHeader = { key: string; value: string };

function originOf(value: string, name: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${name} is not a valid URL, so the Content Security Policy cannot be built`);
  }
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions): string {
  // Fail the build rather than ship a policy that silently blocks admin login.
  const supabaseUrl = options.supabaseUrl?.trim();
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set, so the Content Security Policy cannot allow admin login");
  }
  const supabase = originOf(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  // A DSN carries its key as URL userinfo; the origin drops it.
  const sentryDsn = options.sentryDsn?.trim();
  const sentry = sentryDsn ? originOf(sentryDsn, "NEXT_PUBLIC_SENTRY_DSN") : null;
  const dev = options.isDev;
  // Sources from Vercel's documentation for running the toolbar under a CSP.
  const toolbar = options.isPreview;

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      [
        "'self'",
        "'unsafe-inline'",
        ...(dev ? ["'unsafe-eval'", "https://va.vercel-scripts.com"] : []),
        ...(toolbar ? ["https://vercel.live"] : []),
      ],
    ],
    ["style-src", ["'self'", "'unsafe-inline'", ...(toolbar ? ["https://vercel.live"] : [])]],
    ["img-src", ["'self'", "data:", "blob:", ...(toolbar ? ["https://vercel.live", "https://vercel.com"] : [])]],
    ["font-src", ["'self'", ...(toolbar ? ["https://vercel.live", "https://assets.vercel.com"] : [])]],
    [
      "connect-src",
      [
        "'self'",
        supabase,
        ...(sentry ? [sentry] : []),
        ...(dev ? ["ws:"] : []),
        ...(toolbar ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
      ],
    ],
    ["frame-src", toolbar ? ["https://vercel.live"] : ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];

  return directives.map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ");
}

export function buildSecurityHeaders(options: SecurityHeaderOptions): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    // Two years, as Vercel sends by default, now also covering subdomains. Every
    // demariomontezpb.com name is either served by Vercel over HTTPS or mail-only DNS.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
