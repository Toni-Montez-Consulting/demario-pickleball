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

## Common Agent Workflows

Use these as starting prompts when opening a Copilot or GitHub agent session on this repo.

### Add or fix a unit test
> "Add a Vitest unit test for `src/lib/<file>.ts` that covers `<scenario>`. Follow the same style as existing tests in `src/`."

### Add or fix a Playwright smoke test
> "Add a Playwright test in `e2e/` that covers `<user flow>`. Follow the same style as existing tests in that folder."

### Explain a file or route
> "Explain what `src/app/api/bookings/route.ts` does, the validation it runs, and which Supabase tables it writes."

### Fix a TypeScript or lint error
> "Fix the TypeScript error in `<file>`. Do not change any behaviour — only fix the type issue."

### Update docs
> "Update `docs/DEVELOPER_PLAN.md` to reflect that `<task>` is now complete."

### Safe refactor inside one module
> "Refactor `src/lib/availability.ts` to `<goal>`. Do not change the exported function signatures. Run `npm run ci` to verify."

### Things to avoid asking the agent to do without Tonio on the call
- Change Supabase schema, RLS policies, or run migration SQL
- Edit Google Calendar OAuth or refresh token logic
- Change payment, pricing, waiver, or cancellation copy
- Add, remove, or update environment variables in Vercel
- Enable or change Stripe, DUPR automation, or analytics before they are ready
