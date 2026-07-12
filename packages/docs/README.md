# @fundi/docs

Developer documentation for **completed, end-to-end features** — not a design doc, not a task
tracker, not a place for minute tweaks. Think of each entry as the note you'd want future-you (or
a new teammate) to read before touching a feature area again: what was built, why, and any real
bugs hit along the way with root cause and fix.

This package is intentionally excluded from the Turborepo pipeline: it has no `build`, `lint`, or
`test` script, so `turbo run build|lint|test` silently skips it (this is turbo's normal behavior
for any package lacking a given task's script — not a config workaround).

## When to add an entry

Add a new entry once a feature or unit of scoped work has **landed and is stable** — i.e. it
corresponds to a completed ticket/task, not a work-in-progress branch or an individual commit.
Skip anything that's just a refactor, a dependency bump, or a tweak with no new behavior or
lesson worth preserving.

## Convention

- One file per entry under `features/`, named `NNNN-short-slug.md` where `NNNN` is a
  zero-padded, monotonically increasing 4-digit sequence number (`0001`, `0002`, ...). The
  sequence number is the source of truth for ordering; do not reuse or renumber past entries.
- Each entry should cover, at minimum:
  - **What was built** — a short, concrete summary (not a copy of the ticket).
  - **Why** — the driving requirement/ADR, if any.
  - **Bugs found and fixed** — anything that was a genuine runtime/correctness surprise
    (something that looked like it should work but didn't), with root cause and the fix. Skip
    routine judgment calls that didn't involve a surprise.
  - **How to extend / verify** — the concrete commands a future contributor runs to extend this
    area of the codebase or re-verify it still works.
- Entries are append-only historical record: once written, don't rewrite an old entry to reflect
  later changes — add a new entry instead and cross-reference the old one if relevant.

## Index

| # | Entry | Covers |
|---|-------|--------|
| 0001 | [`features/0001-sprint-0-foundation.md`](./features/0001-sprint-0-foundation.md) | Tasks 1-4: monorepo skeleton, shared config, NestJS skeleton, boundary enforcement |
| 0002 | [`features/0002-task7-frontend-pwas.md`](./features/0002-task7-frontend-pwas.md) | Task 7: apps/creator + apps/learner as installable Next.js PWAs, packages/ui Badge, packages/types enums |
| 0003 | [`features/0003-sprint-0-close-prisma-infra-docs.md`](./features/0003-sprint-0-close-prisma-infra-docs.md) | Tasks 5, 6, 8: Prisma domain schema + query-layer org-scoping + first migration, docker-compose (Postgres/Redis), root README + CONTRIBUTING |
| 0004 | [`features/0004-sprint-0-docker-verification-and-async-context-bug.md`](./features/0004-sprint-0-docker-verification-and-async-context-bug.md) | Docker-dependent Task 5/6 verification once WSL integration was enabled; three real bugs found (test never loaded .env, static `skip` option evaluated before `before()` ran, AsyncLocalStorage context lost across a lazy Prisma promise) |
| 0005 | [`features/0005-design-system-tokens-and-components.md`](./features/0005-design-system-tokens-and-components.md) | Sprint 1 US-001/US-002: "Pulse" design system ported into packages/ui — token layer (light+dark, mobile-first) + 9 components (Button/Input/Card/Badge/Tag/Tabs/Modal/Drawer/EmptyState); creator (dark) + learner (light) wired to consume it |
| 0006 | [`features/0006-render-supabase-github-cicd.md`](./features/0006-render-supabase-github-cicd.md) | Dev deploy: apps/api on Render + Postgres on Supabase, GitHub-driven CI/CD — CI merge gate (lint/test/build + org-isolation test on a CI Postgres), deploy-on-merge to Dev with GitHub `dev` Environment secrets synced to Render via API; render.yaml Blueprint |
| 0007 | [`features/0007-frontend-vercel-cicd-server-env.md`](./features/0007-frontend-vercel-cicd-server-env.md) | Frontends on Vercel (creator, learner), GitHub-driven deploys + PR previews via Vercel CLI; server-only runtime env policy (no NEXT_PUBLIC, enforced by an ESLint guard in @fundi/config) |

## `clickup-sync/` — offline mirror of ClickUp (different from `features/` above)

`clickup-sync/` is not a `features/`-style entry — it's a **point-in-time snapshot** of ClickUp's
Sprint and Product documentation (Product Brief, Technical Architecture ADR, BRDs, Sprints 0-4),
mirrored in so implementation doesn't require live ClickUp access. It is not append-only and not
authored here — it's external content pulled in and periodically re-synced. See
[`clickup-sync/README.md`](./clickup-sync/README.md) for the full file index and re-sync process.
