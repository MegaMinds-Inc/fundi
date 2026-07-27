# Program Builder — technical design

> Companion to ADR-014 (`packages/docs/clickup-sync/product/technical-architecture-adr.md`), which
> covers the domain-model decisions this doc builds on. This doc is the implementation-ready spec:
> API surface, module boundaries, frontend composition, build order, and known gaps.

## Scope

Source of truth is the real `ui_kits/program-builder/` components in the `claude.ai/design`
project (`ProgramSetup.jsx`, `ModuleTree.jsx`, `LessonEditor.jsx`, `PublishBar.jsx`,
`ModuleCover.jsx`, orchestrated by `index.html`) — a two-stage flow (setup → split-panel
tree+editor build stage), reviewed via `Program Builder Review.html`.

**Explicitly out of scope / disregarded:** `Program Builder.dc.html`, a separate unreviewed
3-step-wizard exploration in the same project. It was not adopted — confirmed with the PO. Do not
build against it.

**Also out of scope for this pass:** the new `ui_kits/creator-home/ProgramsHome.jsx` (a redesigned
post-login landing screen). It's a real, related design — see "Known gaps" below for how it
reconciles with the Sprint 2 `DashboardClient.tsx` work already shipped — but wiring it in is a
separate task, not bundled into this one.

## Schema (already migrated — `20260725093014_program_builder_content_model`)

Applied directly against the local dev DB; not yet reflected against staging/prod (no deploy has
happened). Additive only (`ADD COLUMN ... DEFAULT ...`), no destructive changes.

- `Program.status: ProgramStatus` (`draft` default | `published`)
- `Program.publishedAt: DateTime?`
- `Program.coverStyle: ProgramCoverStyle` (`gradient` default | `geometric`)
- `Module.description: String?`
- `Module.unlockMode: ModuleUnlockMode` (`hidden` | `immediate` default | `after_previous` | `after_days`)
- `Module.unlockDays: Int?` (only meaningful when `unlockMode = after_days`)

See ADR-014 for the reasoning (draft/publish is a gate not a freeze; `unlockMode: hidden` covers
module visibility instead of a second field).

## API surface (extends the existing `programs` NestJS module)

Program/Module/Lesson stay one module (ADR-002 boundary: this is one cohesive aggregate, not three
domains) — `apps/api/src/modules/programs/`, which already exists from Sprint 0/2
(`ProgramsService`/`ProgramsController`). Expand it; don't create a new module.

**Program**
- `POST /programs` — create (`title`, `shape`, `visibility`, `description?`, `coverStyle?`).
  Starts `status: draft`.
- `GET /programs/:id` — full detail (program + modules + lessons, ordered) for the builder to load
  on open. Distinct from the existing `GET /programs` list (Sprint 2, summary shape only).
- `PATCH /programs/:id` — update title/description/shape/visibility/coverStyle. Every call bumps
  `updatedAt` (already automatic via Prisma `@updatedAt` on the Program row itself).
- `POST /programs/:id/publish` — validates ≥1 non-`hidden` Module with ≥1 Lesson (400 if not),
  sets `status: published`, `publishedAt: now()`.
- `POST /programs/:id/unpublish` — sets `status: draft`. Does **not** clear `publishedAt`.

**Module** (nested under a program)
- `POST /programs/:id/modules` — create (`title`; `order` = append to end).
- `PATCH /modules/:id` — update `title`/`description`/`unlockMode`/`unlockDays`.
- `DELETE /modules/:id` — cascades to its Lessons (schema already `onDelete: Cascade`).
- `POST /modules/:id/move` — body `{ direction: 'up' | 'down' }`, swaps `order` with the adjacent
  module. Matches the real UI (caret buttons, not drag-and-drop — see "Known gaps").

**Lesson** (nested under a module)
- `POST /modules/:id/lessons` — create (`title`, `type`; `order` = append).
- `PATCH /lessons/:id` — update `title`/`type`/`content` (the type-switch-discards-content
  confirmation is a client-side concern — `LessonEditor.jsx`'s `Modal`; the API just accepts
  whatever `content` shape matches the new `type`).
- `DELETE /lessons/:id`.
- `POST /lessons/:id/move` — same swap-with-adjacent pattern as modules.

**The `Program.updatedAt`-as-aggregate requirement (ADR-014):** every Module/Lesson mutation above
must also touch the parent Program's `updatedAt`, e.g. `programs.update({ where: { id },
data: { updatedAt: new Date() } })` alongside the Module/Lesson write. This is the entire mechanism
behind the "has unpublished changes" badge — get it wrong and that badge silently never lights up.
Write a test for it specifically (create/edit/delete a Lesson, assert the parent Program's
`updatedAt` moved) — this is exactly the kind of subtle-but-silent bug this codebase has hit before
(see `packages/docs/features/0004-*.md`'s AsyncLocalStorage bug for the pattern: correct-looking
code that silently does nothing).

## Frontend — `packages/ui` modules to build

Port the real JSX 1:1 in behavior/composition, swapping local `useState` + `localStorage` for real
API calls via the same BFF-proxy pattern Sprint 2 established (`apps/creator/app/api/programs/...`
routes calling `authFetch`/`authPost`). Build order (dependency-driven):

1. **`ModuleCover`** — pure presentational, zero dependencies, used by everything else
   (`ProgramCard` on the program list, `ModuleTree`'s per-module swatch, `LearnerPreview`). Build
   first.
2. **`ProgramSetup`** — title, description, shape (5-option grid), visibility (2-option list),
   cover-style picker (uses `ModuleCover`). The cover-**image** upload slot (`image-slot`) has no
   backing storage yet — see "Known gaps."
3. **`ModuleTree` + `LessonEditor`** — build together, tightly coupled (selecting a lesson in one
   drives the other). `ModuleTree` includes the settings sub-panel (description + unlock-mode pill
   row + conditional days input) and inline module rename. `LessonEditor` includes the per-type
   field switch, the discard-confirmation `Modal`, and the per-lesson preview `Drawer` (reuses the
   existing `LessonViewer` module from `ui_kits/learner-progress/` — already cataloged in
   `packages/docs/design-system/tasks/learner-progress.md`).
4. **`PublishBar` + `LearnerPreview`** last — depends on having a real `program` shape (status,
   `hasUnpublishedChanges`) to display, and `LearnerPreview` depends on `ModuleCover` +
   `Module.unlockMode` to render the lock overlay.

**App screen** (`apps/creator`): a two-stage route (e.g. `app/programs/[id]/build/`) — setup stage
renders `ProgramSetup`, build stage renders `PublishBar` on top + `ModuleTree`/`LessonEditor`
split-panel (desktop) / stacked (mobile, matches the real orchestrator's `isDesktop` branch).
Autosave (debounced `PATCH` on every field/tree edit) rather than an explicit save button, matching
the real prototype's behavior.

## Known gaps to flag before/during implementation

- **Cover image upload has no backend.** The design's `image-slot` component assumes a working
  upload; Fundi has no object-storage integration yet (§9 of the ADR lists it as "buy/integrate,"
  unselected). Ship `coverStyle` (gradient/geometric, zero-asset) now; treat the image-upload slot
  as visually present but non-functional (or hidden) until storage is chosen — don't block the rest
  of the builder on it.
- **`EnrollmentService.invite()` doesn't check `Program.status` yet** (ADR-014's noted follow-up).
  Add a `status === 'published'` guard there once this ships, so a draft program can't be invited
  into — currently possible, since that check predates this ADR.
- **Drag-and-drop module/lesson reordering is explicitly not designed.** The real UI review doc
  flags this itself: "Not built — PO decision needed." Caret up/down (the `/move` endpoints above)
  is the real, current interaction — build against that, not DnD.
- **`ui_kits/creator-home/ProgramsHome.jsx`** (new post-login landing screen) is a related but
  separate redesign. Its own "Cohorts" tab placeholder text ("next up in the build queue") predates
  and doesn't yet reflect the real Enrollment/Roster wiring already shipped in
  `apps/creator/app/DashboardClient.tsx` (Sprint 2). When ProgramsHome is actually adopted, that
  merge — real program cards + create-CTA from ProgramsHome, real Cohorts-tab Enrollment/Roster
  content already built — needs to happen deliberately, not by picking one file over the other.
- **Video hosting stays embed-only**, unchanged from the original ADR — no change from this
  redesign.

## Verification

- `pnpm --filter api test` — new integration tests for publish validation (blocks empty/hidden-only
  programs), the `updatedAt`-aggregate behavior, and unpublish.
- `pnpm --filter api boundaries` — confirm no new cross-module imports leak outside `programs`'
  barrel.
- Manual: build a program end to end (setup → add module → add lesson → publish → confirm
  `GET /programs` shows it `published` → unpublish → confirm draft again), matching the real
  prototype's own interaction model.
