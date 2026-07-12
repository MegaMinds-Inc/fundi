# 0003 — Sprint 0 close: Prisma domain model, local infra, root docs (Tasks 5, 6, 8)

**Covers:** the Prisma org-scoped domain schema + first migration + query-layer tenant scoping
(Task 5), the local `docker-compose` Postgres/Redis environment (Task 6), and the root
`README.md` + `CONTRIBUTING.md` (Task 8). This closes Sprint 0's build work; see
[`0001`](./0001-sprint-0-foundation.md) (Tasks 1-4) and [`0002`](./0002-task7-frontend-pwas.md)
(Task 7).

## What was built

### Task 5 — Prisma schema + org-scoping + first migration

- **Schema** (`apps/api/prisma/schema.prisma`) — all §3 entities: Organisation, Mentor, Program,
  Module, Lesson, Cohort, Learner, Enrollment, Progress, Assessment, Signal, Channel,
  MessageTemplate, Message, DripJob. The 5 §3 enums (Program shape/visibility, Lesson type,
  Enrollment state, Signal type) plus supporting enums (MentorRole, ChannelType, MessageDirection,
  MessageStatus, DripJobType, DripJobStatus). Enum member names equal the string values in
  `packages/types`, so the DB value, the Prisma enum, and the frontend constant are the same
  string — FE/BE can't drift. Every tenant-scoped table has a required `organisation_id`;
  `Organisation` (the tenant root) does not.
- **Query-layer org scoping** (`apps/api/src/prisma/`) — implemented as a **Prisma client
  extension** (`$extends`, the modern replacement for deprecated `$use` middleware) plus
  `AsyncLocalStorage` for the per-request org context:
  - `org-context.ts` — `runWithOrgContext({ organisationId }, fn)`, `getOrgContext()`,
    `MissingOrgContextError`.
  - `org-scope.ts` — `TENANT_SCOPED_MODELS` + the pure `applyOrgScope(...)` that injects
    `organisationId` into `where` (reads / filtered writes) and `data` (creates/upsert).
  - `scope-operation.ts` — the per-operation decision (throw if no context on a tenant model, else
    scope), extracted so it's unit-testable without a DB or generated client.
  - `prisma.service.ts` / `prisma.module.ts` — `PrismaService` exposes the extended, org-scoped
    `client`; the `@Global()` module makes it injectable everywhere. Wired into `AppModule`.
- **First migration** — `prisma/migrations/20260711000000_init/migration.sql`, generated **offline**
  via `prisma migrate diff --from-empty --to-schema-datamodel` (no running DB needed), plus
  `migration_lock.toml`. `prisma validate` passes.
- **Tests** (Node's built-in `node:test`, zero new deps):
  - `org-scope.test.ts` (runs everywhere) — where-injection across ops, create/upsert stamping,
    the no-context throw, nested-context isolation, and a completeness check that
    `TENANT_SCOPED_MODELS` matches the tables declaring `organisation_id` in the schema.
  - `org-isolation.integration.test.ts` — seeds two orgs and asserts a query as Org A returns zero
    of Org B's rows. Auto-skips when `DATABASE_URL` is unreachable, so `pnpm test` stays green
    without a local DB.
- Deps: `prisma` + `@prisma/client` `6.19.3` (pinned exact, matching repo convention), approved in
  `pnpm-workspace.yaml` `allowBuilds`. `apps/api` `postinstall` runs `prisma generate` so a fresh
  clone builds without a manual step. Test files excluded from the `tsc` build.

### Task 6 — docker-compose (Postgres + Redis)

- `docker-compose.yml` at the repo root — `postgres:16-alpine` and `redis:7-alpine` with
  healthchecks, named volumes, and local-only default credentials; header documents
  up/ps/down/`down -v` (reset).
- `apps/api/.env.example` — `DATABASE_URL`/`REDIS_URL` pointing at the compose services, so
  `cp .env.example .env` is the only config step.

### Task 8 — root README + CONTRIBUTING

- `README.md` — repo layout, prerequisites, the full clone→run bootstrap, common Turbo commands,
  and the docker-compose lifecycle.
- `CONTRIBUTING.md` — the four load-bearing rules each with an ADR-tied "why": pnpm-only (ADR-013),
  `organisation_id` enforced at the query layer (ADR-008), no WhatsApp/LLM SDK outside
  `messaging`/`ai` (§1, ADR-002, ADR-011), phantom-dependency friction is expected (ADR-013); plus
  how to run the boundary check locally.

## Why

Sprint 0's remaining work was the data foundation (schema every later feature builds on), the
local infra to run it, and the written-down conventions a growing team needs. Org scoping is done
as a client extension rather than a repository base class specifically so that *even a direct*
`prisma.client.model.findMany()` is scoped — a base class only protects callers who remember to use
it, which is exactly the "left to individual query authors" failure mode ADR-008 calls out.

## Bugs / gotchas found

- **Prisma extension can't retype `create` inputs.** The extension injects `organisation_id` at
  runtime, but Prisma's *static* types still require it on `create`/`upsert` inputs. So authors
  still pass `organisationId` on writes (the extension overrides it to match context); the
  security-critical *read* path needs no author action. Documented in `apps/api/README.md`.
- **dependency-cruiser 18 refuses Node 25.** It supports `^22 || ^24 || >=26`. The repo `.nvmrc`
  pins 24.18.0 — run `pnpm --filter api boundaries` under `nvm use`. (Verified passing on 24.18.0:
  43 modules, no violations.) Noted in the API README and CONTRIBUTING.

## How to extend / verify

- **Add a tenant-scoped model:** add it to `schema.prisma` with `organisation_id`, add its name to
  `TENANT_SCOPED_MODELS` in `src/prisma/org-scope.ts` (the completeness test fails if you forget),
  run `pnpm --filter api prisma migrate dev` to generate the migration.
- **Verify offline (no DB):** `pnpm --filter api test` (unit scoping tests + integration test
  auto-skips), `pnpm --filter api build`, `pnpm --filter api lint`, and `pnpm --filter api boundaries`
  (under `nvm use`).
- **Complete the runtime verification (needs Docker):** `docker compose up -d` →
  `cp apps/api/.env.example apps/api/.env` → `pnpm --filter api prisma migrate dev` →
  `pnpm --filter api test` (now the org-isolation integration test runs for real). These are the
  two Sprint 0 acceptance criteria still pending the one-time Docker Desktop WSL-integration
  enablement.
