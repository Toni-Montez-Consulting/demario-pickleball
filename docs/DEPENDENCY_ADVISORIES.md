# Dependency Advisories

Use this as the current dependency-risk tracker.

## Current Known Advisories

As of 2026-10-19, after `chore/security-patches`:

- `npm audit --omit=dev` reports **0** production vulnerabilities.
- Before that branch it reported 23 (1 critical, 8 high). `next@16.2.4` alone carried 30
  advisories, including three critical remote-code-execution issues: the Image Optimization
  API with AVIF enabled (this site enables AVIF in `next.config.ts`), `next/og`
  `ImageResponse`, and Windows-hosted servers. Several Middleware/Proxy bypasses were also
  fixed. The newest fixed range was `<16.3.8`; `next@16.4.2` clears all of them.
- The full `npm audit` (dev dependencies included) reports one high advisory,
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces`
  (`<=3.0.3`, every published version). npm counts it as 5 vulnerable packages because
  `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, and `eslint-config-next` depend on
  it. A fix has to come from a new `braces` release or from `micromatch` dropping it. The chain
  runs only on developer machines and in CI, never in production. npm's suggested "fix" is a
  downgrade to `eslint-config-next@14.2.35`, a major-version regression. Do not apply it.

## Overrides

Both temporary overrides were removed on 2026-10-19 because upstream now carries the fixes:

- `postcss`: `next@16.4.2` pins `postcss@8.5.23`, which is patched.
- `svix`: `resend@6.34.1` no longer depends on `svix`.

Re-add an override only for a specific advisory with no upstream fix, and note it here with
the date and the condition for removing it.

## Tooling Notes

- `npm audit fix` and `npm update` on npm 10.9 crash with
  `Cannot read properties of null (reading 'edgesOut')` while resolving vitest's peer set.
  It is an npm/arborist bug, not a lockfile problem: `npm ci` works on both npm 10 and
  npm 11. Use npm 11 (`npx npm@11 install ...`) for that kind of update, or update the vitest
  packages explicitly.
- npm 11 skips install scripts that are not approved and warns about two:
  - `unrs-resolver`: a lint helper. Lint, tests, and the build all pass without it.
  - `@sentry/cli`: its postinstall downloads the CLI binary only when the platform package
    (`@sentry/cli-linux-x64` on Vercel) is missing. That package installs as a normal
    optional dependency, so source-map upload works. If a build ever reports sentry-cli
    missing, approve the script.
- CI runs on Node 24 with `actions/checkout@v7` and `actions/setup-node@v7`, matching Vercel's
  Node 24.x runtime. The Node 20 runner deprecation is resolved.
- Node 22 is the floor: `@supabase/supabase-js` 2.110+ throws in `createClient()` on Node 20,
  which has no native WebSocket. `engines` in `package.json` and `.nvmrc` say 24.x, which is
  what Vercel runs; `engines` overrides the Vercel project setting, so change both together.
- `next-env.d.ts` is generated and gitignored. `next dev` and `next build` write different
  paths into it, so a tracked copy was dirty after every run. `npm run typecheck` runs
  `next typegen` first, so a fresh checkout still type-checks.
- Next 16.4's `experimental.agentUpgrade` (default `security`) stops an agent-run `next build`
  or `next dev` once, with exit code 1, when the installed Next.js has a published advisory.
  Treat that as the signal to patch Next on a `chore/*` branch; a retry proceeds. Leave it on.
- Sentry 11 will drop two things that 10.76 deprecates: the `withSentryConfig` import from
  the package root (now `@sentry/nextjs/config`, done) and `sendDefaultPii`. Move the three
  `sendDefaultPii: false` configs to `dataCollection` before upgrading, keeping PII off.
- The Vitest config is `vitest.config.mts`. Vite 8.3 warns when a `.ts` config with ESM syntax
  loads as CommonJS, which its future native config loader will reject.
- `next dev` occasionally never finishes starting. The log repeats `next/font/google queries
  have exactly one entry` and `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`
  until Playwright's 120-second web-server timeout. About 1 in 30 Google Fonts CSS responses
  (measured 2026-10-19) use `fonts.gstatic.com/l/font?kit=...&skey=...&v=...` URLs, and Next
  16.4's Turbopack font loader cannot parse the `&` in them. The cause is upstream, not this code:
  restart the dev server. No Vercel build has failed this way. Self-hosting Inter and Space
  Grotesk with `next/font/local` would remove the network dependency entirely.

## Policy

- Do not run `npm audit fix --force` blindly.
- Forced audit fixes currently propose breaking package changes and should be tested in a separate branch.
- Prefer normal package updates when Next.js or Resend publish compatible patched versions.
- Keep `actions/checkout` and `actions/setup-node` on current majors; read their breaking-change
  notes before bumping.
- After dependency changes, run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`

## Review Cadence

- Review advisories before broad promotion or paid ads.
- Review again after any Next.js, React, Supabase, or Resend upgrade.
- A Next.js minor that is six months old can carry dozens of advisories, as 16.2.4 did by
  October 2026. Check `npm audit --omit=dev` at least monthly while the site takes bookings.
