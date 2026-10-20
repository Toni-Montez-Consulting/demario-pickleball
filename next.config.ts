import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Next 16.4's `next dev` appends a generated block to AGENTS.md whenever it
  // detects an AI coding agent. AGENTS.md here is curated by hand and kept in
  // sync with CLAUDE.md and agent memory, so a tool must not rewrite it on every
  // dev run. Version-matched Next docs remain at node_modules/next/dist/docs/.
  agentRules: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Built when the server or build starts, so an env change needs a redeploy.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          isDev: process.env.NODE_ENV === "development",
          isPreview: process.env.VERCEL_ENV === "preview",
        }),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
