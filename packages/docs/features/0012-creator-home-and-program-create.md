# 0012 — Creator Home + Create-Program flow (Program Builder, slice 1)

> **Status:** in implementation. **Follows:** [0011](0011-sprint-2-enrollment.md) (enrollment), TDD [`architecture/0002`](../architecture/0002-program-builder-technical-design.md), **ADR-014**.
> **Design reference (vendored):** [`design-ref/`](../design-ref/NOTES.md) — `ProgramsHome.jsx`, `ProgramSetup.jsx`, `ModuleCover.jsx`.
> **Scope of this slice:** the creator **home** (adopt `ProgramsHome`) and the **create-program** flow (`ProgramSetup` → create a draft program that appears on the home). Module/lesson editing + publish are the **next slice** (builder stage 2).

## Where we are (don't rebuild)
- `apps/api/src/modules/programs/` exists: `GET /programs` (real list, org-scoped) + `getProgramWithCohorts`. Schema fully migrated (`Program` incl. `status/publishedAt/coverStyle/ownerMentorId`, `Module` incl. `unlockMode/unlockDays`, all enums). Enrollment (invite/approve/roster) shipped in Sprint 2 and lives in the creator dashboard's **Cohorts** tab.
- `apps/creator/app/DashboardClient.tsx` is today's creator home — mock program grid + real enrollment/roster.
- `@fundi/ui` has `Button/Input/Badge/Tabs/EmptyState` + Phosphor icons.

## Full builder — slice plan
1. **Slice 1 (this doc):** Creator Home + Create Program (draft). ← implementing now
2. **Slice 2:** Builder stage 2 — `ModuleTree` + `LessonEditor` (module/lesson CRUD, `/move`, unlock modes, lesson-type fields).
3. **Slice 3:** `PublishBar` + `LearnerPreview` (publish/unpublish + validation + "unpublished changes").
4. **Follow-ups:** `EnrollmentService.invite()` gate on `status==='published'` (ADR-014); cover-image upload once object storage exists; program list/detail RBAC.

## Slice 1 — work breakdown

### Backend (`apps/api/src/modules/programs/`) — extend the existing module
- **`POST /programs`** — create a **draft**: body `{ title, shape, visibility, description?, coverStyle? }`. Resolve `ownerMentorId` from the principal's Mentor in the current org (via membership/`mentorId`); `status: draft`; org-scoped write (`organisationId` auto-stamped). Return the created program.
- **`GET /programs/:id`** — full detail (program + modules + lessons, ordered) for the builder to load. Org-scoped `findUnique` → 404 (`program_not_found`) if missing/other-org.
- **`PATCH /programs/:id`** — update `title/description/shape/visibility/coverStyle` (autosave from the setup stage). Bumps `updatedAt` automatically.
- **Enrich `GET /programs`** for the home cards: add `status`, `coverStyle`, `moduleCount` (count modules), `learnerCount` (count active enrollments). Extend the `ProgramSummary` type (`@fundi/types`).
- Tests (`OTP_DELIVERY_DRIVER=stub`, org-scoped): create sets draft + owner mentor + org; list returns the new fields/counts; detail 404 cross-org; patch updates + bumps `updatedAt`.
- Module/Lesson CRUD, publish/unpublish → **slice 2/3**, not here.

### Frontend UI (`packages/ui/src/modules/`) — port 1:1, injected-callback pattern (like `AuthFlow`)
- **`ModuleCover`** — pure generative cover (`coverStyle`, `seed`, `height`). Confirm `--base-teal-500/green-500/green-600/ink-900` tokens exist (add/alias if not). Build first.
- **`ProgramSetup`** — controlled `{ value, onChange, onContinue }`; title, shape (5), visibility (2), coverStyle picker (uses `ModuleCover`). **Hide/disable the `image-slot`** (no storage — TDD gap). Continue gated on `title && shape && visibility`.
- **`ProgramsHome`** — `{ programs, onNewProgram, onOpenProgram, cohortsSlot?, needsYouSlot? }`: Programs tab (card grid via `ModuleCover`+`Badge`+counts, or `EmptyState`), plus **injected slots** for the Cohorts / Needs-you tabs so the app can pass the *real* enrollment content in (see reconciliation).
- Both-theme Storybook stories; no play-tests (no runner — 0008 D.2).

### Frontend app (`apps/creator`) — routes + BFF, mirror to learner only where shared
- **Creator home:** replace `DashboardClient`'s mock Programs tab with `ProgramsHome` fed by real `GET /programs`; **RECONCILE** — pass the existing real invite/approve/roster into `ProgramsHome`'s `cohortsSlot` (do NOT regress to the design's placeholder). New-program CTA → `/programs/new`. Card → `/programs/[id]/build`.
- **`/programs/new`** — renders `ProgramSetup` (client owns `value`); on Continue → `POST /api/programs` → redirect to `/programs/[id]/build`.
- **`/programs/[id]/build`** — loads `GET /programs/:id`; renders `ProgramSetup` prefilled + autosave (`PATCH`), plus a clearly-marked **"Modules & lessons — coming next"** placeholder for stage 2.
- **BFF proxy routes:** `app/api/programs/route.ts` (GET list, POST create), `app/api/programs/[id]/route.ts` (GET, PATCH) via `authFetch`/`authPost`. Distinguish server-unreachable (503) vs 5xx (502) like the auth routes.

## Locked decisions (ADR-014/TDD)
Draft/publish gate (not freeze); cover **image deferred** (ship `coverStyle` only); reorder caret `/move` (next slice); video embed-only; quiz out; `Program.updatedAt`-as-aggregate is enforced on Module/Lesson mutations (slice 2).

## Verification
- `pnpm --filter api test` (new program-create/list/detail/patch tests) · `pnpm --filter api boundaries` · `pnpm turbo build` / `lint`.
- `pnpm --filter @fundi/ui build-storybook` (new module stories, both themes).
- Manual: home (empty → create) → `/programs/new` → fill setup → Continue → draft persisted → shows on home as a Draft card → reopen edits via `/programs/[id]/build`. Enrollment/roster still works in the Cohorts tab.
- Env: ensure `OTP_DELIVERY_DRIVER=stub` locally; API running (`pnpm dev:backend`).
