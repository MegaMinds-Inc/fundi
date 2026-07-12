# Contributing to Fundi

These are the conventions that are easy to forget once the team grows past the people who were in
the architecture discussion. Each is load-bearing — tied to a specific ADR, not a style
preference. Read this before your first PR. Setup lives in the [README](README.md).

## The four rules

### 1. Use `pnpm` — never `npm` or `yarn`

pnpm's strict, non-flat dependency resolution is what enforces the workspace module boundary: a
package can only import what it explicitly declares. `npm`/`yarn` flatten `node_modules`, which
would silently let one package import another's transitive dependencies and quietly erode the
boundaries the architecture depends on.

**Why:** ADR-013 — strict resolution extends ADR-002's module-boundary discipline to the workspace
level. There is a single `pnpm-lock.yaml`; a `package-lock.json` or `yarn.lock` appearing in a PR
is a red flag.

### 2. Every tenant-scoped table carries `organisation_id` — enforced, not remembered

Fundi is a shared-database multi-tenant system. Every tenant-scoped table has a required
`organisation_id`, and scoping is enforced at the query layer by the Prisma client extension in
`apps/api/src/prisma/` — **not** by individual query authors remembering to add a `where` clause.
A PR that adds a new tenant-scoped model must:

- add the `organisation_id` column (see existing models in `apps/api/prisma/schema.prisma`), and
- add the model name to `TENANT_SCOPED_MODELS` in `apps/api/src/prisma/org-scope.ts`
  (the completeness test in `org-scope.test.ts` will fail if these drift apart).

Data access goes through `PrismaService`'s scoped `client` inside a `runWithOrgContext(...)` scope
— never a raw, unscoped `PrismaClient` in product code.

**Why:** ADR-008 — a missed scoping check is a cross-tenant data leak, so it must be a tested,
enforced pattern rather than a code-review convention.

### 3. No direct WhatsApp/Meta calls outside Messaging; no direct LLM calls outside AI

Product/domain logic never talks to WhatsApp directly — it goes through the `messaging` module's
channel abstraction, so the core never knows it's WhatsApp. Likewise, no module makes LLM provider
calls except the `ai` module, which owns prompts, guardrails, and cost controls behind one seam.

**Why:** §1, ADR-002, ADR-011 — these two modules are the only sanctioned integration seams for
their external SDKs, which keeps the channel and AI providers swappable and the blast radius
contained. This is enforced by `apps/api/.dependency-cruiser.cjs` (see rule 4 for how to run it).

### 4. pnpm's strict resolution can surface "phantom dependency" errors — that's expected

On your first install, you may hit errors about a module not being found that "worked before" on an
npm/yarn project. That usually means the code was relying on a *phantom dependency* — a transitive
package it never declared. The fix is to add the dependency explicitly to that package's
`package.json`, not to work around pnpm.

**Why:** ADR-013 (Negative consequence) — this friction is the boundary doing its job, not a bug.

## Before you push

Run the same checks CI will, ideally on the pinned Node (`nvm use`):

```bash
pnpm turbo lint
pnpm turbo test
pnpm turbo build
pnpm --filter api boundaries    # module-boundary + WhatsApp/LLM SDK isolation (rules 2 & 3)
```

`boundaries` is the authoritative, graph-based enforcement of the module isolation from rules 2–3.
It uses dependency-cruiser, which requires Node `^22 || ^24 || >=26` — run it under the version in
`.nvmrc`, not Node 25. To confirm the check actually works (not just passing because nothing
violates it), deliberately add a cross-module internal import, confirm `pnpm --filter api boundaries`
fails, then revert.

## Commits & PRs

- Branch off `main`; keep PRs scoped to one concern.
- A PR touching `apps/api/prisma/schema.prisma` must include the generated migration
  (`pnpm --filter api prisma:migrate`) and keep `TENANT_SCOPED_MODELS` in sync (rule 2).
