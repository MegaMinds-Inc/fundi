# Fundi

Monorepo for Fundi — a create-and-forget teaching platform for mentors and coaches in African
markets, built around WhatsApp delivery, phone-first learner identity, and a "needs you" attention
queue. See the [Product Brief](packages/docs/clickup-sync/product/product-brief.md) and
[Technical Architecture ADR](packages/docs/clickup-sync/product/technical-architecture-adr.md) for
the full picture.

## Repo layout

| Path | What it is |
| --- | --- |
| `apps/api` | NestJS modular-monolith backend (ADR-002). Domain modules + Prisma. |
| `apps/creator` | Creator PWA — Next.js, the mentor dashboard/builder (ADR-012). |
| `apps/learner` | Learner PWA — Next.js, deliberately thin lesson-view app (ADR-012). |
| `packages/config` | Shared ESLint / Prettier / `tsconfig` base, consumed via `workspace:*` (ADR-013). |
| `packages/ui` | Shared design-system components used by both PWAs. |
| `packages/types` | Shared domain enums (mirrors the Prisma enums so FE/BE can't drift). |
| `packages/docs` | Developer + product documentation (synced from ClickUp). |

Tooling: **pnpm workspaces** + **Turborepo** (ADR-013). See [CONTRIBUTING.md](CONTRIBUTING.md) for
the rules that keep the workspace boundaries intact — read it before your first PR.

## Prerequisites

- **Node** — the version in [`.nvmrc`](.nvmrc) (`nvm use`). The `boundaries` check (dependency-cruiser)
  does not run on Node 25; the pinned LTS avoids that.
- **pnpm** ≥ 11 (`corepack enable` will provide the pinned version). Never use `npm`/`yarn` here —
  see CONTRIBUTING.
- **Docker** with the Compose plugin — for local Postgres + Redis. On Windows/WSL, enable
  Docker Desktop's WSL integration for your distro first (Settings → Resources → WSL integration).

## Local bootstrap

From a fresh clone to a running API + PWAs:

```bash
# 1. Use the pinned Node and install all workspace deps (pnpm, not npm/yarn).
nvm use
pnpm install                                   # also generates the Prisma client (postinstall)

# 2. Start local infrastructure (Postgres + Redis).
docker compose up -d                           # see docker-compose.yml
docker compose ps                              # both should report "healthy"

# 3. Point the API at the local DB/queue and apply the schema.
cp apps/api/.env.example apps/api/.env         # defaults already match docker-compose
pnpm --filter api prisma:migrate               # = prisma migrate dev; applies migrations to the local DB

# 4. Run everything (or a single app).
pnpm turbo dev                                 # all apps
# or, individually:
pnpm --filter api dev                          # http://localhost:3000  (GET /health)
pnpm --filter creator dev                      # http://localhost:3001
pnpm --filter learner dev                      # http://localhost:3002
```

## Common commands

```bash
pnpm turbo build          # build every package/app (respects the dependency graph)
pnpm turbo lint           # lint everything
pnpm turbo test           # test everything
pnpm --filter api boundaries   # module-boundary + SDK-isolation check (run with `nvm use` first)
```

## Local infrastructure

`docker-compose.yml` at the repo root runs Postgres and Redis with local-only defaults that match
`apps/api/.env.example`.

```bash
docker compose up -d      # start (detached)
docker compose ps         # health status
docker compose down       # stop, keep data
docker compose down -v    # stop AND wipe all local DB/Redis state (reset to empty)
```

If `docker` reports it "could not be found in this WSL 2 distro", enable WSL integration in Docker
Desktop settings — it's a one-time host GUI action, not a repo problem.

## Further reading

- [CONTRIBUTING.md](CONTRIBUTING.md) — the load-bearing conventions (pnpm, org-scoping, module isolation).
- [`apps/api/README.md`](apps/api/README.md) — API dev, module boundaries, Prisma/org-scoping details.
- [`packages/docs`](packages/docs) — architecture ADRs, BRDs, and per-sprint task breakdowns.
