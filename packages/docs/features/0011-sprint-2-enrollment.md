# Sprint 2 — Program Access & Enrollment

## What was built

Full-stack implementation of Sprint 2 (Program Access & Enrollment):

- **Seed data** (`apps/api/prisma/seed.ts`, `pnpm --filter api db:seed`) — the Sprint 2 "bridging
  story" (86capbyc3). Creates one demo org with a self-paced/public program and a cohort/private
  program (two cohorts), each with a module + two lessons. Idempotent (no-ops if the fixed-id org
  already exists), since the Program/Module/Lesson/Cohort/Enrollment schema itself was already live
  from Sprint 0's original domain-model migration — the bridging story only needed fixtures, not a
  schema change.
- **`ProgramsService`** (`apps/api/src/modules/programs/`) — real org-scoped `listPrograms()` and
  `getProgramWithCohorts()`, replacing the Sprint-0 stub. Exported from the module barrel so
  `EnrollmentModule` can inject it via Nest DI (barrel-only boundary rule).
- **`EnrollmentService` + `EnrollmentController`** (`apps/api/src/modules/enrollment/`) —
  `POST /enrollment/invite`, `POST /enrollment/:id/approve`, `POST /enrollment/:id/decline`,
  `GET /enrollment/roster?programId=`. Reuses `PhoneService` (exported from `AuthModule`) for E.164
  normalization rather than duplicating it. Org-scoping is automatic via the existing
  `OrgContextInterceptor` — no extra code needed beyond not being `@Public()`.
- **`enrollment.integration.test.ts`** — 11 cases against the live DB (invite state derivation,
  approve, decline hard-delete, re-invite-after-dropped reactivation, conflict on re-invite,
  roster bucketing for both self-paced and cohort programs, org isolation, and the cohort-required
  regression below).
- **`apps/creator`** — new BFF routes under `app/api/{programs,enrollment}/` proxying via the
  existing `authFetch`/`authPost` helpers. `DashboardClient.tsx` reworked: the "Programs" tab now
  shows real seeded programs (picker); the "Cohorts" tab shows the real `InviteApprove` +
  `CohortRoster` modules (already built in `packages/ui`, unchanged) wired to live data.
- **`packages/ui`'s `Tabs`** gained an optional controlled `value` prop (additive, backward
  compatible) so selecting a program can programmatically switch to the Cohorts tab — the
  component previously only supported `defaultValue` (seed-once, no external re-sync).

## Why

Per the Sprint 2 release-increment goal: a mentor can invite a learner by phone, see them through
`pending_approval` → `active` for private programs (or straight to `active` for public ones), and
manage a cohort roster. Program Builder UI itself stays out of scope (blocked on missing design
files, per the sprint doc).

## Real bug found and fixed

**Symptom:** inviting a learner into a cohort-shaped program with `cohortId: null` succeeded (200,
valid `Enrollment` row created) but the learner then never appeared in `GET /enrollment/roster`'s
response for that program.

**Root cause:** `getRoster()` buckets active enrollments per real `Cohort` row; the "no cohorts at
all" synthetic `_all` bucket only applies when the program has zero `Cohort` rows. An enrollment
with `cohortId: null` on a program that *does* have cohorts matches no bucket's filter — the row
exists in the database but is invisible everywhere the UI reads the roster from.

**How it was found:** not by reasoning about the code, but by actually exercising the real HTTP
pipeline end-to-end (a throwaway script minting a valid JWT and calling the live endpoints) rather
than trusting the service-level integration tests alone — those tests always passed the correct
`cohortId` because I wrote the fixtures, so they never exercised this path. The unit-level tests
looked complete but weren't actually representative of a real (or malformed) client request.

**Fix:** `EnrollmentService.invite()` now rejects `cohortId: null` with a 400 `cohort_required` when
the target program has any real `Cohort` rows — an enrollment nobody can see is worse than an
explicit rejection. Locked in with a new regression test
(`invite() rejects a null cohortId when the program has real cohorts`).

**Lesson:** the same principle from Sprint 0/1 — verify surprising-looking gaps by actually running
the real request path, not just the tests you wrote to match your own implementation — applied
again here, this time against a live HTTP server rather than a database query.

## Deviations from the original plan

- Skipped `enrollment.responses.ts` (planned to mirror `auth.responses.ts`'s convention). That file
  exists in `auth/` specifically to widen shared types with server-only fields (`refreshToken`,
  `deviceSecret`) the browser must never see. Enrollment's API responses have no such server-only
  widening — the shared `@fundi/types` DTOs already are the exact response shape, so a parallel
  file would have been pure duplication.
- `packages/ui`'s `Tabs` component was modified (additive `value` prop) — the original plan said "no
  new `packages/ui` components needed," which was true, but didn't anticipate needing to extend an
  existing one for programmatic tab navigation.

## How to extend / verify

- Re-seed: `pnpm --filter api db:seed` (idempotent).
- Re-run the enrollment suite: `pnpm --filter api test` (needs `docker compose up -d` +
  `pnpm --filter api prisma:migrate` first).
- `pnpm --filter api boundaries` to re-check the module-boundary rules if adding cross-module DI.
- See `packages/docs/product-owner-flags/0001-sprint-2-open-questions.md` for the product
  ambiguities this pass surfaced and how each was resolved or deferred.
