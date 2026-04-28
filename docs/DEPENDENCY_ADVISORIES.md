# Dependency Advisories

Use this as the current dependency-risk tracker.

## Current Known Advisories

- `npm audit --omit=dev` reports 0 known production vulnerabilities as of April 27, 2026.
- `postcss` is pinned through an npm override to the patched 8.5.x line until Next.js carries that update directly.
- `svix` is pinned through an npm override to 1.92.2 until Resend carries that update directly.
- GitHub Actions warns that Node.js 20-based actions are deprecated. GitHub plans to default JavaScript actions to Node.js 24 on June 2, 2026, and remove Node.js 20 runner support on September 16, 2026.

## Policy

- Do not run `npm audit fix --force` blindly.
- Forced audit fixes currently propose breaking package changes and should be tested in a separate branch.
- Prefer normal package updates when Next.js or Resend publish compatible patched versions, then remove the temporary overrides after `npm audit --omit=dev` stays clean.
- Keep `actions/checkout` and `actions/setup-node` current, and verify the Node.js 24 transition before GitHub's June 2, 2026 default change.
- After dependency changes, run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`

## Review Cadence

- Review advisories before broad promotion or paid ads.
- Review again after any Next.js, React, Supabase, or Resend upgrade.
