# Dependency Advisories

Use this as the current dependency-risk tracker.

## Current Known Advisories

- `postcss < 8.5.10` is reported through the Next.js dependency tree.
- `uuid < 14.0.0` is reported through `resend -> svix`.
- GitHub Actions warns that Node.js 20-based actions are deprecated and will move to Node.js 24 defaults in 2026.

## Policy

- Do not run `npm audit fix --force` blindly.
- Forced audit fixes currently propose breaking package changes and should be tested in a separate branch.
- Prefer normal package updates when Next.js or Resend publish compatible patched versions.
- Keep `actions/checkout` and `actions/setup-node` current, and review the Node.js 24 transition before GitHub's 2026 cutoff.
- After dependency changes, run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`

## Review Cadence

- Review advisories before broad promotion or paid ads.
- Review again after any Next.js, React, Supabase, or Resend upgrade.
