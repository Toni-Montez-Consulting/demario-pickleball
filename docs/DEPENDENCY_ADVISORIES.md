# Dependency Advisories

Use this as the current dependency-risk tracker.

## Current Known Advisories

- `postcss < 8.5.10` is reported through the Next.js dependency tree.
- `uuid < 14.0.0` is reported through `resend -> svix`.

## Policy

- Do not run `npm audit fix --force` blindly.
- Forced audit fixes currently propose breaking package changes and should be tested in a separate branch.
- Prefer normal package updates when Next.js or Resend publish compatible patched versions.
- After dependency changes, run:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e`

## Review Cadence

- Review advisories before broad promotion or paid ads.
- Review again after any Next.js, React, Supabase, or Resend upgrade.
