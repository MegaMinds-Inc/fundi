# 0004 — Sprint 0 Docker verification: three real bugs the DB-backed test had been hiding

**Covers:** running the two Docker-dependent acceptance criteria from Task 5 (Prisma migration +
org-isolation integration test) and Task 6 (`docker compose up -d`) for real, once Docker
Desktop's WSL integration was enabled. Closes out the last two pending acceptance criteria from
[`0003`](./0003-sprint-0-close-prisma-infra-docs.md).

## What was built

Nothing new architecturally — this is a verification pass that found and fixed real bugs in
`0003`'s Prisma/org-scoping work, which had been impossible to catch until a live Postgres was
available:

- `docker compose up -d` — both `fundi-postgres` and `fundi-redis` come up healthy with zero
  manual config, confirming Task 6's acceptance criteria.
- `pnpm --filter api prisma:migrate` — applies cleanly against the live DB.
- `pnpm --filter api test` — all 19 tests pass, 0 skipped (previously 17 pass / 2 skipped, both
  skips silently vacuous — see below).

## Why

Task 5's own acceptance criteria explicitly require a DB-backed integration test ("A test that
seeds two orgs' data and queries as Org A confirms zero rows from Org B are returned"), and it was
written to auto-skip gracefully when no DB is reachable — a reasonable design so `pnpm test` stays
green on a machine without Docker. But "designed to skip gracefully when absent" quietly became
"has never once actually run" once Docker access itself was blocked for the whole Sprint 0 window
(see [`0001`](./0001-sprint-0-foundation.md)'s note on the WSL integration blocker). The moment
Docker became available, three real bugs surfaced in immediate succession — each one only visible
once the previous was fixed.

## Bugs found and fixed

### 1. The test script never loaded `.env`, so `dbAvailable` stayed false even with Postgres up

**Symptom:** `docker compose ps` showed both services healthy, `prisma migrate dev` connected and
applied cleanly (Prisma's CLI loads `.env` itself) — but `pnpm --filter api test` still reported
the org-isolation suite's two real assertions as `# SKIP`.

**Root cause:** the `test` script was plain `node -r ts-node/register --test "..."`. Unlike Prisma
CLI commands, a raw `node` process doesn't load `.env` files on its own — so `DATABASE_URL` was
simply absent from `process.env` for the test process, `raw.$connect()` failed, and the suite's
own "skip gracefully when unreachable" logic did exactly what it was designed to do — just for the
wrong reason.

**Fix:** added Node's built-in `--env-file-if-exists=.env` flag to the `test` script. Verified with
a standalone script confirming `DATABASE_URL` was now visible in `process.env`.

### 2. `{ skip: !dbAvailable }` is evaluated at test *registration* time, not run time

**Symptom:** even after fixing (1), the two assertions still showed `# SKIP`.

**Root cause:** `it('...', { skip: !dbAvailable }, async () => {...})` — the `skip` option is a
plain object evaluated **synchronously** when `describe()`'s callback registers every `it()`, which
happens *before* the async `before()` hook has run to determine real DB availability. `dbAvailable`
was still `false` (its initial value) at the moment `!dbAvailable` was evaluated, so `skip: true`
got baked into the test permanently — `before()` setting `dbAvailable = true` later had no effect
on an already-registered option.

**Fix:** moved the check inside each test body using Node's dynamic `t.skip(reason)` API instead
of the static `skip` option, so it's evaluated at run time (after `before()` has completed) rather
than at registration time.

**Lesson:** this is a general trap, not a Prisma/DB-specific one — any `{ skip: <expression> }`
that depends on state only known asynchronously will silently and permanently skip, no matter what
that state later becomes. Prefer `t.skip()` inside the test body for any condition determined in
an async `before()`.

### 3. `runWithOrgContext` lost its `AsyncLocalStorage` context before Prisma's extension ever saw it

**Symptom:** with (1) and (2) fixed, the assertions finally ran for real — and immediately failed:
`runWithOrgContext({ organisationId: ORG_A }, () => scoped.program.findMany())` threw
`MissingOrgContextError`, even though the call was correctly wrapped exactly as documented.

**Root cause:** Prisma's query methods (`findMany`, etc.) return a *lazy* thenable — calling
`scoped.program.findMany()` does not dispatch the query immediately; it only starts when the
returned value is awaited or `.then()`'d. The original `runWithOrgContext` was:
```ts
export function runWithOrgContext<T>(context: OrgContext, fn: () => T): T {
  return storage.run(context, fn);
}
```
`storage.run(context, fn)` calls `fn()` synchronously, gets back the *unstarted* lazy Prisma
promise, and returns it immediately — popping the `AsyncLocalStorage` context as `run()` exits.
The actual query (and this app's org-context check inside the `$allOperations` extension) only
fires later, when the *caller* awaits the returned promise — by which point the ALS context is
long gone. Confirmed with a standalone repro (`AsyncLocalStorage` + a bare `$extends` client, no
NestJS/test-runner involved) before touching the real implementation: logging `storage.getStore()`
inside `$allOperations` printed `undefined` even though the exact same log one line earlier
(inside the `run()` callback, before the call) correctly showed the bound context.

**Fix:** made `runWithOrgContext` `async` and `await fn()` *inside* the `storage.run()` callback,
so the query's actual dispatch is a continuation of the still-active `run()` zone rather than
something the external caller triggers later, outside it:
```ts
export async function runWithOrgContext<T>(
  context: OrgContext,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  return storage.run(context, async () => fn());
}
```
Re-ran the standalone repro with this shape first to confirm the fix before applying it to the
real file — `storage.getStore()` inside `$allOperations` then correctly showed the bound context.

**Lesson:** `AsyncLocalStorage.run(store, fn)` only keeps `store` bound for the synchronous extent
of `fn()` and for any async work `fn()` itself directly awaits — not for a lazy value `fn()` merely
*returns* and that something else awaits later. This is a general pitfall wherever `AsyncLocalStorage`
meets a lazy/deferred-execution API (ORM query builders, in this case) — the wrapping helper must
own the `await`, not delegate it to the caller.

### Also fixed (masked until the above three unblocked real execution)

`before()`/`after()` test hooks deleted `Mentor` rows before the `Program` rows that reference
them via `ownerMentorId`, violating the `programs_owner_mentor_id_fkey` foreign key constraint —
invisible until the suite actually ran against real seeded data for the first time. Delete order
corrected to `Program` → `Mentor` → `Organisation` in both hooks.

## How to extend / verify

- **Re-run the full Docker-dependent verification:** `docker compose up -d` →
  `cp apps/api/.env.example apps/api/.env` → `pnpm --filter api prisma:migrate` →
  `pnpm --filter api test` — expect 19/19 passing, 0 skipped.
- **If a new test needs DB-availability-dependent skipping:** use `t.skip(reason)` inside the test
  body (checked at run time), never `{ skip: <expr> }` as a static `it()` option if `<expr>`
  depends on anything determined asynchronously in `before()`.
- **If a new helper wraps `AsyncLocalStorage.run()` around an ORM/lazy-promise API:** make the
  helper `async` and `await` the wrapped call *inside* the `run()` callback — never return an
  unawaited thenable from it and expect the caller's later `await` to still be "inside" the bound
  context.
- **Full pipeline sanity:** `pnpm lint`, `pnpm build`, `pnpm --filter api boundaries` — all
  re-verified green after these fixes.
