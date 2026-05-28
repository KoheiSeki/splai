# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

**This is the planning & design repository for SPLAI**, not the implementation. There is no application code here — only specs, phase plans, learning guides, brand assets, and conventions. Actual implementation lives in a **separate repository `splai-app`** that gets created during Phase 0, Task 1 (see `docs/superpowers/plans/2026-05-24-phase-0-setup.md`).

When the user asks to implement features, write code, run tests, or deploy, they almost certainly mean the `splai-app` repo. Confirm before producing code in this repo.

## Document Layout

```
docs/
├── design/
│   └── splai-brand-identity.html    ← Canonical brand source (visual design, voice, type, color)
├── conventions.md                    ← Coding standards, branch strategy, JSON casing rules
└── superpowers/
    ├── specs/design.md              ← App design spec (architecture, data model, API, NFRs)
    ├── plans/                       ← Phase implementation plans (one per phase)
    └── guides/                      ← Learning guides accompanying plans
```

Top-level `README.md` is the **phase index** — it tracks each phase's status (📝 計画作成中 / 🔒 未着手 / ✅ 完了) and Definition of Done.

## Authoring Rules

### Source of truth precedence

When information conflicts between documents, this order wins:
1. `docs/design/splai-brand-identity.html` for visuals, voice, color, type
2. `docs/superpowers/specs/design.md` for architecture, data model, API contracts
3. `docs/conventions.md` for naming, branching, casing, tooling
4. `docs/superpowers/plans/<phase>.md` for the current phase's exact tasks
5. `README.md` for phase status

The design spec §12 explicitly defers to the brand HTML; do not duplicate visual decisions across files.

### Just-In-Time planning

Per `README.md`'s agile policy: **only the current and next phase get detailed plans.** Don't preemptively detail Phase 2+ while Phase 0 is still in progress. Update `README.md`'s status column when a phase changes state.

### When generating new plans or specs

- Plans go to `docs/superpowers/plans/YYYY-MM-DD-phase-N-<topic>.md` and follow the plan format documented at the bottom of `README.md`.
- Use the `superpowers:writing-plans` skill for new plans, `superpowers:brainstorming` before creative work.
- Plans assume implementation will happen in `splai-app`, with TDD steps and concrete bash commands per task.

### When updating existing docs

- Phase plans contain test code and expected outputs that real implementation must match. If you change a plan, the corresponding implementation in `splai-app` must be updated, and vice versa — keep them synchronized.
- After implementing a phase, update `README.md`'s phase status and check off the Definition of Done items in the plan.

## Key Project Decisions Already Made

These are baked in across multiple documents — don't relitigate them without being asked:

- **Stack**: Next.js 15+ (App Router) on Vercel + FastAPI on Fly.io + Supabase Postgres. AI via IBM Consulting Advantage API (Claude Sonnet 4.6). OCR via GCP Vision.
- **Auth model**: No login. UUID URLs + `localStorage` member_id + `X-Member-Id` header validated by FastAPI. Service Role Key in backend, RLS not used.
- **JSON casing**: Wire format is **camelCase**. Backend Python uses snake_case internally; conversion is done **on the backend** via Pydantic `alias_generator=to_camel`. Frontend never converts. (See `docs/conventions.md` §8.4.)
- **Branching**: Git Flow Lite — `main` (production) ← `develop` (Vercel preview) ← `feature|fix|chore/<slug>`. Squash merge for feature PRs, merge commit for release PRs.
- **Commits**: Conventional Commits with scopes `frontend|backend|infra|db|ai|auth`. Co-authored-by AI lines are explicitly **not** added in this project.
- **Brand red rule**: `--red` (`#E8000C`) is used **only when AI is actively working** (chat input, OCR processing, AI explanation generation). Not a general accent color.

## Communication

All documents and discussions in this project are in **Japanese (日本語)**. Write new docs and PR/commit messages in Japanese unless the user explicitly asks for English. Code identifiers, file paths, and technical keywords stay in English.

## What This Repo Does NOT Have

- No `package.json`, `pyproject.toml`, or build system
- No tests to run, no lint to run, no dev server to start
- No `.github/workflows/` (CI lives in `splai-app`)

If a tool tries to discover these (e.g. via auto-detection), it will find nothing and that is correct.
