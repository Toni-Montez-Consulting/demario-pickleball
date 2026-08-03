# GitHub Copilot Instructions

This is DeMario Montez's pickleball coaching site — a client-engagement project that is close to a live launch. Changes must be surgical and tested.

## Project overview

- **Stack**: Next.js 15 (App Router, TypeScript), Supabase (PostgreSQL + Auth), Vercel
- **Default branch**: `master`
- **CI command**: `npm run ci` (typecheck → lint → test → build)
- **E2E tests**: `npm run test:e2e` (Playwright; run for booking, payment, and admin-flow changes)

## Source of truth

| Need | File |
|---|---|
| Current code/ops status | `docs/DEVELOPER_PLAN.md` |
| Launch verification checklist | `docs/RELEASE_CHECKLIST.md` |
| Admin operating guide for DeMario | `docs/ADMIN_HANDOFF.md` |
| Plain-language business tasks | `docs/MARIO_ACTION_PLAN.md` |
| Portfolio playbook links | `docs/PLAYBOOK.md` |

## Coding guidelines

- Make precise, minimal changes. This is a launch-sensitive client project, not a playground.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Branch naming: `fix/*`, `feat/*`, `docs/*`, or `chore/*`.
- Never commit `.env.local`, Supabase keys, Google tokens, or Sentry/Resend keys.
- Follow existing patterns: App Router route handlers, Supabase server client, `src/lib/` utilities.
- Keep public-facing copy (pricing, cancellation, waiver language) unchanged unless Tonio and Mario agree.

## High-risk files — think twice before editing

- `src/app/api/bookings/` — availability, double-booking prevention
- `src/app/api/admin/` — MFA-gated admin routes
- `src/lib/availability.ts` — centralised slot rules used by both API and UI
- `src/lib/googleCalendar.ts` — OAuth refresh token flow
- Any Supabase migration SQL in `docs/`

## What Copilot is safe to help with

- Adding or fixing Vitest unit tests in `src/` (mirror existing test style)
- Updating or adding Playwright smoke tests in `e2e/`
- TypeScript type fixes and small refactors inside a single module
- Writing or updating non-sensitive documentation in `docs/`
- Explaining how a specific file or route works
- Suggesting copy improvements that do not touch legal/payment wording
