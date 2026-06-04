# Agent Instructions

This repo is DeMario Montez's pickleball coaching site. Treat it as a client-engagement repo: useful, practical, launch-sensitive, and not a playground for broad refactors.

## Global Standing Rules

These rules apply to every repo in this workspace. Full canonical versions are in `~/.claude/CLAUDE.md`.

**Deep Questioning:** Before any design or build work — ask deeply. Multiple rounds before writing. Never assume from context.
**Always Show File Paths:** Every file or artifact must include its exact Windows path in the response text, every time.
**Framework Freedom:** No framework default without a stated product reason.
**Limitations Check:** State ceiling / failure mode / best practice / alternatives / verdict before implementing any new approach.
**Truthful Reporting:** Separate implemented, verified, deployed, and remaining.
**Durable Rule Persistence:** When a new rule is established, update CLAUDE.md + AGENTS.md + memory + Codex immediately.
**Context Transparency:** Proactively state context limits. Training cutoff August 2025 — flag outdated library/API knowledge. Don't silently work around compacted context.
**Anti-Lazy Execution:** Never default to the convenient or easy path. When a proper approach exists — established workflow, right tool, full process — use it. If a proper path is blocked, state why and find the right alternative. Never approximate.
**No Domain-Derived Aesthetics:** Visual direction comes from the product's object model, not domain conventions.
**Platform Craft Methodology (7 patterns):** (1) Default rejection first, (2) Object-before-class, (3) Anatomy pass per object, (4) Property intent, (5) Depth as presence, (6) Element-level logo-swap test, (7) Persona routing before layout.

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

## Interface Origination Rule

For serious booking, payment, admin, public-flow, or client-facing UI work, do
not start from broad screens, generic cards, default dashboards, or copied kit
components. Refine one product-native component/object first, then lock an
Interface Code Contract: HTML anatomy, fields, labels, actions, class
vocabulary, CSS primitives, states, permissions, mobile behavior, banned
defaults, and backend/API/state behavior. This does not block narrow bugfixes,
but it does block calling serious interface work reviewable.

## Verification

- Default code verification: `npm run ci`.
- Run `npm run test:e2e` for booking, payment, admin, or public-flow changes.
- For docs-only changes, state that code verification was skipped because no runtime files changed.
- Before broad promotion, use `docs/RELEASE_CHECKLIST.md`.
