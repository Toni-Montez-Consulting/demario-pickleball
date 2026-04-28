# Agent Instructions

This repo is DeMario Montez's pickleball coaching site. Treat it as a client-engagement repo: useful, practical, launch-sensitive, and not a playground for broad refactors.

## Source Of Truth

Read these first:

- `docs/DEVELOPER_PLAN.md` for current code/ops status
- `docs/RELEASE_CHECKLIST.md` for launch verification
- `docs/ADMIN_HANDOFF.md` for DeMario-facing operating guidance
- `docs/MARIO_ACTION_PLAN.md` for business tasks DeMario can complete
- `docs/PLAYBOOK.md` for the shared portfolio playbook links

If these disagree, use `docs/DEVELOPER_PLAN.md` for code work and `docs/MARIO_ACTION_PLAN.md` for Mario-facing business work.

## Delivery Rules

- Default branch is `master`.
- Use `fix/*`, `feat/*`, `docs/*`, or `chore/*` branches for normal work.
- Keep one purpose per branch and one repo per commit series.
- Do not mix Mario-facing business tasks with developer-only implementation tasks.
- Use Conventional Commits.
- Do not commit secrets, `.env.local`, Supabase keys, Google refresh tokens, Sentry tokens, or Resend keys.

## High-Risk Areas

Be stricter around:

- bookings and time-slot availability
- payments, payment copy, and cancellation policy
- admin auth and MFA-gated routes
- Google Calendar OAuth and refresh tokens
- Supabase RLS, rate limiting, and public PII
- production monitoring and launch checklists

## Verification

- Default code verification: `npm run ci`.
- Run `npm run test:e2e` for booking, payment, admin, or public-flow changes.
- For docs-only changes, state that code verification was skipped because no runtime files changed.
- Before broad promotion, use `docs/RELEASE_CHECKLIST.md`.
