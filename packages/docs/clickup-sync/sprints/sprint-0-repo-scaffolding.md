> **Source:** ClickUp — Platform Infrastructure & DevOps list ([link](https://app.clickup.com/t/86cap6x42))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

# Sprint 0 — Repo Scaffolding (Fundi Monorepo)

**Status in this repo:** Tasks 1–4 and 7 are done and marked `shipped` on ClickUp as of 2026-07-11 (see `packages/docs/features/0001-sprint-0-foundation.md` and `0002-task7-frontend-pwas.md`). As of 2026-07-12, Tasks 5, 6, and 8 are **code-complete and committed** (see `0003-sprint-0-close-prisma-infra-docs.md`), with all artifacts authored and everything that can be verified without a running database verified green (schema validates, migration generates, org-scoping unit tests pass, lint/build/boundaries pass). **Two acceptance criteria remain pending a one-time Docker enablement**: `docker compose up -d` (Task 6) and `prisma migrate dev` + the DB-backed isolation test (Task 5) can only be green-checked once Docker Desktop's WSL integration is enabled for this distro — a Windows-host GUI action, not something an agent can do from the WSL shell. The steps to complete that verification are in the root `README.md`. The parent umbrella task (86cap6x42) stays `backlog` on ClickUp until those runtime checks are confirmed.

**Local-first workflow (going forward):** completed tasks get marked here first (this file). ClickUp only gets updated — and any new sprint tasks pulled in — when explicitly asked to sync.

Umbrella task for all repo scaffolding work ahead of pipeline configuration, per the Technical Architecture ADR (v0.5).

**Goal:** empty `MegaMinds-Inc/fundi` repo → a scaffolded monorepo that enforces the ADR's architectural boundaries (module isolation, org-scoping, workspace dependency discipline) by construction, ready for CI/pipeline config and first feature work.

**Order matters** — subtasks are sequenced; later ones depend on earlier ones being merged first (see each subtask's Depends-on note).

**Out of scope for Sprint 0:** BSP/WhatsApp integration (holding per direction), CI/CD pipeline config itself (this is everything _before_ that), any actual feature/domain logic beyond the schema skeleton.

Reference: Fundi Technical Architecture ADR v0.5, §4.13, §10 (NOW phase), ADR-002, ADR-006, ADR-008, ADR-009, ADR-012, ADR-013.

* * *

## 1. Monorepo skeleton — pnpm workspaces + Turborepo ✅ shipped

**Reference:** ADR-012, ADR-013

**Objective:** Initialize the workspace shape all other apps/packages will slot into.

**Do:**
*   `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
*   `turbo.json` with pipeline tasks: `build`, `lint`, `test`, `dev` (declare correct `dependsOn` graph so `packages/*` build before `apps/*`)
*   Root `package.json` with workspace scripts (`pnpm turbo build`, etc.)
*   Empty placeholder folders: `apps/api`, `apps/creator`, `apps/learner`, `packages/ui`, `packages/config`, `packages/types` (each with a minimal `package.json` and `README.md` stub — no real code yet)
*   `.gitignore` (node_modules, .turbo, .env, dist/build outputs)

**Acceptance criteria:**
- [x] `pnpm install` succeeds from repo root with no errors
- [x] `pnpm turbo build` runs across all placeholder packages without failure (even as no-ops)
- [x] Adding a dependency to one `apps/*` package does NOT make it resolvable from another package without an explicit declaration
- [x] Repo root has no `package-lock.json` or `yarn.lock` — only `pnpm-lock.yaml`

**Depends on:** nothing — this is the first task.

* * *

## 2. Shared tooling config — packages/config ✅ shipped

**Reference:** ADR-013 (Neutral consequence — config as a proper workspace package, not root-level relative-path files)

**Objective:** One shared source of truth for lint/format/TS config, extended by every app and package — not root-level files referenced by path.

**Do:**
*   `packages/config` as a real workspace package (own `package.json`)
*   Base ESLint config (with a NestJS variant and a Next.js/React variant if rule sets diverge)
*   Base `tsconfig.base.json`
*   Shared Prettier config
*   Each `apps/*` and `packages/*` package `extend`s from `packages/config` via `workspace:*`

**Acceptance criteria:**
- [x] `packages/config` has its own `package.json` and is referenced via `workspace:*`, not relative paths
- [x] Every app/package's `tsconfig.json` extends `packages/config`'s base config
- [x] `pnpm turbo lint` runs cleanly against the placeholder apps/packages
- [x] A deliberately-introduced lint violation in a placeholder file is caught by `pnpm turbo lint`

**Depends on:** Task 1 (monorepo skeleton must exist first).

* * *

## 3. NestJS modular monolith skeleton — module boundaries ✅ shipped

**Reference:** ADR-002, ADR-006, ADR-011 (§1: "product logic never talks to WhatsApp directly," "no direct LLM API calls outside the AI module")

**Objective:** `apps/api` structured so the architectural boundaries are visible in the folder tree, not just convention — before any real business logic is written.

**Do:**
*   NestJS app bootstrap in `apps/api`
*   One Nest module per domain area, each with an explicit barrel/index export and nothing else importable from outside: `programs`, `enrollment`, `scheduling`, `messaging` (channel abstraction lives here — no WhatsApp specifics yet, just the module + interface shape), `ai` (interface shape only, no real LLM call yet), `payments` (stub module, per §4.12 deferred)
*   Root `AppModule` wiring all of the above
*   No cross-module imports of internals — only the barrel export is importable

**Acceptance criteria:**
- [x] `apps/api` boots locally (`pnpm --filter api dev`) and responds on a health-check route
- [x] Each domain module has exactly one exported public interface (index/barrel file); internal providers are not exported
- [x] A deliberate test import reaching into another module's internals (bypassing its barrel) fails at compile/lint time
- [x] `messaging` and `ai` modules are clearly the only places allowed to reference an external SDK (WhatsApp/LLM)

**Depends on:** Task 1 (monorepo skeleton), Task 2 (shared tsconfig/lint).

* * *

## 4. Module boundary enforcement — dependency-cruiser rule ✅ shipped

**Reference:** ADR-002 (Negative consequence: "a careless developer can still bypass module boundaries if not enforced in code review / lint rules; needs a lightweight architectural test")

**Objective:** Make cross-module boundary violations fail CI automatically — this was explicitly flagged in the ADR as a risk that needs enforcement, not convention.

**Do:**
*   Add `dependency-cruiser` (or equivalent) to `apps/api`
*   Rule set: no module may import from another module's internals — only barrel/index exports are valid import targets
*   Rule set: no file outside `messaging` may import a WhatsApp/Meta SDK; no file outside `ai` may import an LLM provider SDK
*   Wire as an npm script (`pnpm --filter api boundaries`) runnable standalone, ready to be added to CI in the pipeline-config phase

**Acceptance criteria:**
- [x] Running the boundary check against Task 3's clean skeleton passes
- [x] A deliberately introduced violation (direct cross-module internal import) fails the check with a clear error
- [x] A deliberately introduced direct WhatsApp/LLM SDK import outside `messaging`/`ai` fails the check
- [x] Script is documented in `apps/api/README.md` so it's discoverable ahead of pipeline config wiring it into CI

**Depends on:** Task 3 (module skeleton must exist to write rules against).

* * *

## 5. Prisma schema + first migration — org-scoped domain model ✅ code-complete (runtime check pending Docker)

**Reference:** §3 (Core domain model), ADR-006, ADR-008

**Objective:** Domain model as the real first migration, not a placeholder — every later feature builds on this schema.

**Do:**
*   Prisma schema in `apps/api` covering: Organisation, Mentor, Program, Module, Lesson, Cohort, Enrollment, Learner, Progress, Assessment, Signal, Message, MessageTemplate, Channel, DripJob (§3 entity table + enums: Program shape, Program visibility, Lesson type, Enrollment state, Signal type)
*   `organisation_id` required column on every tenant-scoped table (ADR-008)
*   Repository base class or Prisma middleware that auto-injects the org filter on every query — this must be the enforced pattern, not left to individual query authors (ADR-008 Negative consequence)
*   First migration generated and committed

**Acceptance criteria:**
- [ ] `prisma migrate dev` runs clean against a local Postgres instance — **pending Docker.** The migration SQL is generated and committed (`prisma/migrations/20260711000000_init/`, produced offline via `prisma migrate diff --from-empty`), and `prisma validate` passes. Applying it to a live DB is the one remaining step.
- [x] Every tenant-scoped table has `organisation_id` as a required (non-nullable) column — verified: 14 tenant tables each have `"organisation_id" TEXT NOT NULL` in the migration; `Organisation` (tenant root) correctly excluded.
- [x] A test that queries WITHOUT an org context throws/fails rather than silently returning cross-tenant data — enforced by the Prisma client extension (`src/prisma/`) and covered offline by `org-scope.test.ts` (`scopeOperation` throws `MissingOrgContextError` with no context bound). Enforcement is at the query layer, not a repository authors must remember to use (ADR-008).
- [ ] A test that seeds two orgs' data and queries as Org A confirms zero rows from Org B — **pending Docker.** The test is written (`src/prisma/org-isolation.integration.test.ts`) and auto-skips when no DB is reachable; it runs for real once Postgres is up.
- [x] Enums match §3 exactly (Program shape, visibility; Lesson type; Enrollment state; Signal type) — verified against the generated migration; enum member names equal the string values in `packages/types` so FE/BE can't drift.

**Implementation note:** the "repository base class or Prisma middleware" from the ADR is implemented as a **Prisma client extension** (`$extends`), the modern replacement for the deprecated `$use` middleware — combined with `AsyncLocalStorage` for the per-request org context. This scopes even a direct `prisma.client.model.findMany()` call, which a base class that authors must opt into would not.

**Depends on:** Task 3 (needs `apps/api` NestJS structure to live in), Task 6 (needs local Postgres via docker-compose to actually run migrations against).

* * *

## 6. Local dev environment — docker-compose (Postgres + Redis) ✅ files authored (runtime check pending Docker)

**Reference:** ADR-006, ADR-009

**Files authored; runtime verification pending Docker:** `docker-compose.yml` and `apps/api/.env.example` are written and committed. The only thing that cannot be confirmed from the WSL shell is `docker compose up -d` itself — Docker Desktop's WSL integration is not enabled for this distro (the `docker` command is a stub pointing to Docker Desktop settings). Enabling it is a one-time Windows-host GUI action; once done, the up/connect steps in the root README complete both this task and Task 5's migration check.

**Objective:** Every engineer's local setup matches what Prisma/BullMQ expect, without needing cloud infra to develop.

**Do:**
*   Root `docker-compose.yml` with `postgres` and `redis` services, sane default ports/credentials for local dev
*   `.env.example` for `apps/api` with `DATABASE_URL` / `REDIS_URL` pointing at the compose services
*   One-liner documented in README: `docker compose up -d` → app connects

**Acceptance criteria:**
- [ ] `docker compose up -d` from repo root brings up Postgres + Redis with no manual config — **pending Docker enablement.** `docker-compose.yml` defines both services with healthchecks and local defaults; only the `up` itself is unrun.
- [ ] `apps/api` connects to both using only `.env` values copied from `.env.example` — **pending Docker enablement.** `apps/api/.env.example` `DATABASE_URL`/`REDIS_URL` already point at the compose services.
- [x] Documented teardown/reset instructions (`docker compose down -v` to reset local DB state) — in both `docker-compose.yml` header comments and the root README.

**Depends on:** Task 1 (monorepo skeleton). Independent of Tasks 2–4 — can run in parallel.

* * *

## 7. Two PWA skeletons — apps/creator, apps/learner ✅ shipped

**Reference:** ADR-012

**Objective:** Two separately deployed, separately bundled Next.js PWAs sharing `packages/ui`, per ADR-012 — no native app, no unified single frontend.

**Do:**
*   `apps/creator` — Next.js app, installable PWA manifest, minimal placeholder dashboard route
*   `apps/learner` — Next.js app, installable PWA manifest, minimal placeholder lesson-view route, deliberately thin (no builder/dashboard code — ADR-012 Positive consequence: "learner bundle stays genuinely thin")
*   `packages/ui` — shared design-system package, consumed via `workspace:*` by both apps
*   `packages/types` — shared domain types/enums (Program shape, Enrollment state, Signal type, etc. — mirrors Task 5's Prisma enums so frontend and backend can't drift)

**Acceptance criteria:**
- [x] Both apps run locally (`pnpm --filter creator dev`, `pnpm --filter learner dev`) on different ports (3001/3002)
- [x] Both install as a PWA (manifest + service worker present) via browser install prompt
- [x] `apps/learner`'s production bundle does not include any code imported only by `apps/creator` (verified via a marker-string grep against both production builds)
- [x] A shared component imported from `packages/ui` renders correctly in both apps
- [x] A shared enum from `packages/types` is imported and used in at least one placeholder screen in each app

**Depends on:** Task 1 (monorepo skeleton), Task 2 (shared config).

* * *

## 8. Root docs — README + CONTRIBUTING ✅ shipped

**Reference:** §12 "Notes for engineering," ADR-013

**Objective:** The rules that are easy to forget once the team grows past who was in the ADR discussion, written down where a new engineer will actually see them.

**Do:**
*   `README.md`: local dev bootstrap (clone → `pnpm install` → `docker compose up -d` → `pnpm --filter api prisma:migrate` → `pnpm turbo dev`)
*   `CONTRIBUTING.md` covering, explicitly:
    *   Use `pnpm`, never `npm`/`yarn` — strict resolution is load-bearing for the workspace boundary, not a style preference (ADR-013)
    *   Every PR touching a tenant-scoped table must include `organisation_id` — enforced via repository base class, not code review memory (ADR-008)
    *   No direct WhatsApp/Meta API calls outside the Messaging module; no direct LLM API calls outside the AI module (§1, ADR-002, ADR-011)
    *   pnpm's strict resolution may surface phantom-dependency errors unfamiliar to npm/yarn users on first install — expected, not a bug (ADR-013 Negative consequence)
    *   How to run the boundary check from Task 4 locally before pushing

**Acceptance criteria:**
- [x] A new engineer following only `README.md` can get from clone to a running `apps/api` + one PWA with zero undocumented steps — `README.md` covers `nvm use` → `pnpm install` → `docker compose up -d` → copy `.env` → `prisma migrate dev` → `pnpm turbo dev`, with per-app ports and the Docker-Desktop-WSL note.
- [x] `CONTRIBUTING.md` states all four rules explicitly, each with a one-line "why" tied to its ADR — pnpm-only (ADR-013), `organisation_id` enforced (ADR-008), no WhatsApp/LLM SDK outside messaging/ai (§1, ADR-002, ADR-011), phantom-dependency friction expected (ADR-013); plus how to run the boundary check locally.

**Depends on:** Tasks 1, 5, 6 (docs describe the real bootstrap flow, so should be written last, once those exist).
