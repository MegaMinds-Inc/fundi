# @fundi/api

NestJS modular monolith. See ADR-002, ADR-006, ADR-011.

## Development

```
pnpm --filter api dev              # ts-node + node --watch, http://localhost:3000
pnpm --filter api build            # tsc build (excludes *.test.ts)
pnpm --filter api lint             # eslint (includes barrel-only import check)
pnpm --filter api test             # node --test over src/**/*.test.ts
pnpm --filter api boundaries       # dependency-cruiser: module boundary + SDK isolation check
pnpm --filter api prisma:migrate   # prisma migrate dev (needs local Postgres — see root README)
pnpm --filter api prisma:generate  # regenerate the Prisma client after a schema change
pnpm --filter api prisma:studio    # open Prisma Studio against the local DB
```

Dev runs on `ts-node` (not `tsx`) — `tsx`'s esbuild transpiler does not implement
`emitDecoratorMetadata`, which breaks NestJS constructor dependency injection silently.

`boundaries` (dependency-cruiser 18) requires Node `^22 || ^24 || >=26` — it refuses to run on
Node 25. Use the version pinned in the repo `.nvmrc` (`nvm use`) before running it.

## Database & org-scoping (ADR-006, ADR-008)

The domain model lives in `prisma/schema.prisma` (§3 of the Technical Architecture). Every
tenant-scoped table carries a required `organisation_id`; `Organisation` itself is the tenant
root and is not scoped.

**Scoping is enforced at the query layer, not by convention.** `src/prisma/` provides:

- `PrismaService` (`src/prisma/prisma.service.ts`) — wraps `PrismaClient` in a client extension.
  Inject it and use `prisma.client` for all data access; there is no unscoped client exposed to
  product code.
- `runWithOrgContext({ organisationId }, fn)` (`src/prisma/org-context.ts`) — binds the current
  org for the async call stack (via `AsyncLocalStorage`). A request guard/interceptor sets this
  once per request from the authenticated principal.
- The extension, for every op on a tenant-scoped model, **throws `MissingOrgContextError` if no
  org context is bound** (never runs unscoped) and **injects `organisationId`** into the query's
  `where` (reads / filtered writes) or `data` (creates). The pure logic lives in
  `src/prisma/org-scope.ts` + `scope-operation.ts` and is unit-tested in `org-scope.test.ts`.

Known limitation: the extension injects `organisationId` at *runtime*, so Prisma's *static* types
still require it on `create`/`upsert` inputs — authors pass it, and the extension overrides it to
match the context (a create can't be mis-attributed to another org). The security-critical read
path (`findMany`/`findFirst`/`update`/`delete`) is filtered with no author action required.

### Running the migration and the isolation test

These need a local Postgres (`docker compose up -d` from the repo root — see the root README):

```
docker compose up -d                    # start Postgres + Redis
cp apps/api/.env.example apps/api/.env   # DATABASE_URL / REDIS_URL defaults match compose
pnpm --filter api prisma migrate dev     # apply prisma/migrations to the local DB
pnpm --filter api test                   # runs the DB-backed org-isolation integration test too
```

`src/prisma/org-isolation.integration.test.ts` seeds two orgs and asserts a query as Org A returns
zero of Org B's rows. It **auto-skips** when `DATABASE_URL` isn't reachable, so `pnpm test` stays
green without the local DB; the pure scoping logic is always covered offline by `org-scope.test.ts`.

## Health check

`GET /health` -> `{ "status": "ok", "timestamp": "<ISO8601>" }`

## Module boundaries

Each domain module (`src/modules/<name>`) exposes exactly one public surface: its `index.ts`
barrel. Do not import a module's internal files (`*.service.ts`, `*.controller.ts`, interfaces)
from outside that module's own folder — import the module class (and any exported interface
types) from the barrel only.

This is enforced two ways:
- `pnpm --filter api lint` — ESLint `import-x/no-restricted-paths` (resolves imports to their
  actual file path, so it also catches deep relative imports), fast, local check.
- `pnpm --filter api boundaries` — `dependency-cruiser`, authoritative, graph-based check. See
  `.dependency-cruiser.cjs`.

`messaging` and `ai` are the only modules permitted to import an external WhatsApp/Meta SDK or LLM
provider SDK, respectively (ADR-011 §1). This is enforced by `.dependency-cruiser.cjs` — the SDK
name patterns there are best-guesses since no real SDK is installed yet; review and tighten once
the real SDK choice is made.
