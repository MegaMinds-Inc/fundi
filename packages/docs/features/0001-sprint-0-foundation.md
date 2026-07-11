# 0001 — Sprint 0 foundation (Tasks 1-4)

**Covers:** pnpm/Turborepo workspace skeleton, `@fundi/config` shared lint/format/TS config,
`apps/api` NestJS modular-monolith skeleton, dependency-cruiser module-boundary enforcement.

## What was built

- **Task 1 — workspace skeleton.** Root `pnpm-workspace.yaml` (`apps/*`, `packages/*`),
  root `package.json` with `turbo run <task>` scripts (`build`/`lint`/`test`/`dev`), and
  `turbo.json` defining the task pipeline: `build` (`dependsOn: ["^build"]`, caches
  `dist/**`/`.next/**`), `lint` (`dependsOn: ["^lint"]`), `test` (`dependsOn: ["^build"]`,
  caches `coverage/**`), `dev` (uncached, persistent). Six placeholder packages were scaffolded
  (`apps/api`, `apps/creator`, `apps/learner`, `packages/config`, `packages/ui`,
  `packages/types`), each with a no-op `build`/`test`/`dev` (`node -e "console.log(...)"`) so the
  turbo graph resolves end-to-end from day one, before any package has real content.

- **Task 2 — `@fundi/config`.** One shared config package, consumed via `workspace:*` by every
  other package (never by relative path — this is a hard convention, referenced as ADR-013).
  Exports three ESLint flat-config variants (`./eslint/base`, `./eslint/nestjs`,
  `./eslint/next`), a shared `./tsconfig.base.json` (`target: ES2022`, `module`/
  `moduleResolution: NodeNext`, `strict: true`, plus the usual safety flags), and `./prettier`.
  Consumers extend/import these, then apply their own per-runtime overrides on top (see apps/api's
  tsconfig override below — this pattern repeats for Next.js apps in Task 7).

- **Task 3 — `apps/api` NestJS skeleton.** Six domain modules (`programs`, `enrollment`,
  `scheduling`, `messaging`, `ai`, `payments`) plus a `health` module, each exposing exactly one
  public surface: its `index.ts` barrel. Internal files (`*.service.ts`, `*.controller.ts`,
  interfaces) are private to their own module folder — nothing outside a module may import them
  directly. `GET /health` returns `{ "status": "ok", "timestamp": "<ISO8601>" }`.

- **Task 4 — dependency-cruiser boundary enforcement.** `apps/api/.dependency-cruiser.cjs` adds
  three graph-level rules on top of the ESLint check: (1) no cross-module internal imports
  (mirrors the ESLint rule, but authoritative/graph-based), (2) only the `messaging` module may
  import a WhatsApp/Meta SDK, (3) only the `ai` module may import an LLM provider SDK. Run via
  `pnpm --filter api boundaries`. Neither SDK is actually installed yet (Sprint 0 holds
  BSP/WhatsApp integration), so rules 2-3 are best-guess regexes against likely future package
  names — review and tighten once the real SDK choice lands. If a future WhatsApp integration
  calls the Graph API via raw HTTP with no SDK import, this tool structurally cannot catch that.

## Why

Establish a working monorepo skeleton with enforced conventions (shared config, module
boundaries) before any real feature code lands, so every subsequent task builds on a consistent,
already-verified foundation rather than retrofitting structure later.

## Bugs found and fixed

These are the two genuine "should have worked but didn't" surprises from this phase — the kind of
knowledge that's easy to silently re-discover (and re-waste time on) without a record.

### 1. `tsx` silently breaks NestJS dependency injection

**Symptom:** Running `apps/api` via `tsx` (esbuild-based TS runner) appeared to start
successfully, but NestJS constructor-based DI failed — services weren't being injected as
expected. `GET /health` (no DI) worked fine; `GET /programs` (injects `ProgramsService`) returned
a 500 with `Cannot read properties of undefined (reading 'listPrograms')`.

**Root cause:** `tsx` uses esbuild for on-the-fly transpilation, and esbuild does not implement
TypeScript's `emitDecoratorMetadata` compiler option. NestJS's DI container relies on
`emitDecoratorMetadata` emitting `design:paramtypes` metadata (via `reflect-metadata`) at
transpile time to resolve constructor parameter types at runtime. Without it, Nest has no way to
know what to inject, and fails silently rather than erroring loudly at startup.

**Fix:** Switched `apps/api`'s `dev` script from `tsx` to `ts-node`
(`node --watch -r ts-node/register src/main.ts`), which uses the real TypeScript compiler and
correctly emits decorator metadata. Documented directly in `apps/api/README.md` so a future
contributor doesn't "helpfully" switch back to the faster `tsx` and silently reintroduce the bug.

**Lesson:** A DI failure with no error message is a classic silent-breakage class of bug — always
verify a new tooling choice against real runtime behavior (inject a dependency, confirm it's
actually populated), not just "does the process start without crashing."

### 2. ESLint core `no-restricted-imports` doesn't catch relative-path boundary violations

**Symptom:** The intended module-boundary rule (domain modules may only be imported via their
`index.ts` barrel) needs to block `import { ProgramsService } from '../programs/programs.service'`
from outside the `programs` module. Using ESLint core's built-in `no-restricted-imports` rule
against the module path pattern did not catch this violation when deliberately tested.

**Root cause:** `no-restricted-imports` matches against the raw import specifier **text** (e.g.
the literal string `'../programs/programs.service'`), not the import's resolved file path. Since
violating imports are typically relative paths that don't textually match a configured
package-name-style pattern, the rule silently passed on exactly the case it was meant to catch.

**Fix:** Replaced it with `eslint-plugin-import-x`'s `no-restricted-paths` rule, which resolves
imports to their actual target file path before matching (via `eslint-import-resolver-typescript`
for TS path/alias resolution) — so relative-path violations are caught regardless of how the
import specifier is written. This is layered with the dependency-cruiser check from Task 4 as a
second, graph-based enforcement (`pnpm --filter api boundaries`) for defense in depth.

**Lesson:** Don't assume a plausible-sounding ESLint rule name does what its name implies — always
run the negative-case verification (deliberately inject the exact violation you're trying to
block, confirm the linter actually flags it) before trusting a boundary/security-adjacent rule.
This applies broadly, not just to this rule.

## How to extend / verify

- **Add a new domain module to `apps/api`:** create `src/modules/<name>/` with an `index.ts`
  barrel exporting only the module class (and any public interface types); add the module class
  to `AppModule`'s `imports` array in `src/app.module.ts`. Do not import another module's internal
  files directly — only its barrel.
- **Verify the boundary check still passes:** `pnpm --filter api lint` (fast, ESLint-based) and
  `pnpm --filter api boundaries` (authoritative, dependency-cruiser-based). To confirm the checks
  are actually working (not just passing because nothing violates them yet), deliberately add a
  relative-path import into another module's internal file, confirm both commands fail, then
  revert.
- **Re-run the whole pipeline from repo root:** `pnpm build`, `pnpm lint`, `pnpm test` (all via
  `turbo run <task>`, respecting the `dependsOn` graph).
