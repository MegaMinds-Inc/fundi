# Fundi — orientation for a new session

Fundi is an AI-powered, WhatsApp-first creator/course platform (Africa-first). Read
[`packages/docs/README.md`](packages/docs/README.md) first — it indexes everything: append-only
feature writeups (`features/`), the ClickUp mirror (`clickup-sync/`, point-in-time snapshot, not
live), and the design-system audit/task backlog (`design-system/`).

**Local-first workflow (standing instruction from the project owner):** mark completed work in the
local `clickup-sync/sprints/*.md` files first. Only sync to ClickUp itself when explicitly asked.

## Current state / where to pick up

**Sprint 0** (repo scaffolding) and **Sprint 2** (Enrollment & Cohort Management) are implemented
and verified — see `packages/docs/features/0011-sprint-2-enrollment.md` and the sprint sync docs
under `packages/docs/clickup-sync/sprints/`.

**Program Builder redesign — designed, not yet implemented.** The design was reviewed (in the
`claude.ai/design` project) and the domain-model decisions are locked in:
- [`packages/docs/clickup-sync/product/technical-architecture-adr.md`](packages/docs/clickup-sync/product/technical-architecture-adr.md) — **ADR-014** (draft/publish is a gate, not a content freeze; `Module.unlockMode` gains `hidden` for per-module visibility instead of a separate field; generative `coverStyle`, no image uploads required).
- [`packages/docs/architecture/0002-program-builder-technical-design.md`](packages/docs/architecture/0002-program-builder-technical-design.md) — **the implementation-ready spec**: API surface (extends the existing `apps/api/src/modules/programs/` module — Program/Module/Lesson CRUD, `/publish`, `/unpublish`, `/move`), `packages/ui` module build order (`ModuleCover` → `ProgramSetup` → `ModuleTree`+`LessonEditor` → `PublishBar`+`LearnerPreview`), and explicitly flagged gaps (no object storage yet for cover-image upload, `EnrollmentService.invite()` doesn't gate on `Program.status` yet, drag-and-drop reorder is undesigned — use caret up/down).

Schema is already migrated (`Program.status`/`publishedAt`/`coverStyle`, `Module.description`/
`unlockMode`/`unlockDays` — migration `20260725093014_program_builder_content_model`, applied
locally). **Next concrete step: implement against the design doc** — NestJS endpoints first
(testable independent of frontend), then the `packages/ui` modules in the stated order, then wire
into `apps/creator`.

**Source of truth for the design:** `ui_kits/program-builder/` in the `claude.ai/design` project
(project id `f94947bd-41d7-404e-968a-7470f3a5037f`) — `ProgramSetup.jsx`, `ModuleTree.jsx`,
`LessonEditor.jsx`, `PublishBar.jsx`, `ModuleCover.jsx`. **Disregard** `Program Builder.dc.html` in
that same project (an unreviewed alternate 3-step-wizard exploration, explicitly not adopted).
Access via the `DesignSync` MCP tool (`get_project`/`list_files`/`get_file`).

## Environment quirks (cost real time to discover — don't re-learn them)

- Repo lives in **WSL Ubuntu-22.04** at `/home/princeabaidoo/Projects/fundi`. From Windows tools,
  address it via the UNC path `\\wsl.localhost\Ubuntu-22.04\home\princeabaidoo\Projects\fundi`.
- Running shell commands via `wsl.exe` from a Windows Bash/PowerShell tool: prefix with
  `MSYS_NO_PATHCONV=1` or Git-Bash's automatic path conversion mangles arguments. Always
  `export PATH="/home/princeabaidoo/.nvm/versions/node/v24.18.0/bin:/usr/bin:/bin"` first — the
  default PATH picks up Windows `pnpm`/`node` shims that don't work under WSL.
- **Never run `git config`**, even if asked — use per-commit `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/
  `GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL` env vars instead (`AbaidooPrince` /
  `abaidooprince@gmail.com`). Never push without asking first.
- `apps/api/.env` has had `OTP_DELIVERY_DRIVER` accidentally left on `"sms"` instead of the
  `.env.example` default `"stub"` at least once — breaks the auth integration tests and blocks
  manual login testing with a mysterious `lastCodeFor is not a function` error. Check this first if
  auth tests fail for no obvious reason.
- Dev DB: `docker compose up -d` (Postgres + Redis), then `pnpm --filter api prisma:migrate`, then
  `pnpm --filter api db:seed` (idempotent — creates a demo org with one public/self-paced and one
  private/cohort program, safe to re-run).
- `pnpm turbo build` / `pnpm turbo lint` / `pnpm --filter api boundaries` (dependency-cruiser module
  boundaries) are the standard full-repo verification commands — run all three before considering
  a change done.
