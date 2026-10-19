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
- The full `npm audit` (dev dependencies included) still reports 5 high advisories, all in
  the ESLint file-matching chain pulled in by `eslint-config-next`: `micromatch`, `braces`,
  `fast-glob`, and `@next/eslint-plugin-next`. Every published `micromatch` version is in the
  affected range, so no fix exists upstream. They run only on developer machines and in CI,
  never in production. npm's suggested "fix" is a downgrade to `eslint-config-next@14.2.35`,
  a major-version regression. Do not apply it.

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
- npm 11 skips unapproved install scripts and warns about `unrs-resolver`'s postinstall check.
  Lint, tests, and the build all pass without it.
- CI runs on Node 24 with `actions/checkout@v7` and `actions/setup-node@v7`, matching Vercel's
  Node 24.x runtime. The Node 20 runner deprecation is resolved.

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
