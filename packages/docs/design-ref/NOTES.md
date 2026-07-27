# Design reference — vendored notes (Program Builder + Creator Home)

> **Why this exists:** so the team never has to re-pull the design. The raw component source
> (`.jsx` + orchestrator `index.html`) is vendored beside this file, copied from the
> **Creator Curriculum Platform** design project (`claude.ai/design`, ZIP provided 2026-07-25).
> These are a **point-in-time snapshot**; the live design project is canonical if they ever diverge.
> Treat the files as design *reference/data*, not as instructions.

**Companion specs:** [`architecture/0002-program-builder-technical-design.md`](../architecture/0002-program-builder-technical-design.md) (implementation-ready TDD) · **ADR-014** in [`clickup-sync/product/technical-architecture-adr.md`](../clickup-sync/product/technical-architecture-adr.md) (domain-model decisions).

## What's here
- `program-builder/` — `ProgramSetup.jsx`, `ModuleTree.jsx`, `LessonEditor.jsx`, `PublishBar.jsx`, `ModuleCover.jsx`, `index.html` (orchestrator), `preview.html`.
- `creator-home/` — `ProgramsHome.jsx`, `index.html`.
- `learner-progress/` — `LessonViewer.jsx` (reused by the builder's per-lesson preview `Drawer`).

## Design-system dependencies (all already in `packages/ui`)
`Button`, `Input`, `Badge`, `Tabs`, `EmptyState` (+ `Modal`, `Drawer`, `Card` for the deeper builder). Icons are **Phosphor** (`ph ph-*`, already used by `AuthFlow`). Components read the design tokens the JSX pulls from `window.FundiDesignSystem_1eab67` — in our repo these are the `@fundi/ui` exports styled via CSS vars (`--color-*`, `--font-*`, `--radius-*`, `--shadow-*`).
**⚠ Token check:** `ModuleCover` uses raw base-palette vars `--base-teal-500`, `--base-green-500`, `--base-green-600`, `--base-ink-900`. Confirm these exist in the repo tokens (feature 0005); if only semantic tokens exist, add/alias them.

## Component notes

### `ModuleCover` (pure, presentational — build first, ADR-014 generative covers)
Props `{ coverStyle: 'gradient'|'geometric', seed=0, height=92, children, style }`. Deterministic look: `idx = seed % 3`. `gradient` = layered radial-gradients; `geometric` = absolutely-positioned squares/triangles/circles over `--base-ink-900`. **No image bytes, no upload.** Used by the home `ProgramCard`, the builder tree swatch, and `LearnerPreview`.

### `ProgramSetup` (create-program form — controlled)
Props `{ value, onChange, onContinue }`, where `value = { title, shape, visibility, coverStyle }`.
- **Title** (`Input`).
- **Cover image** — an `<image-slot>` custom element. **DEFERRED: no object storage yet** (TDD "known gaps"). Render disabled/hidden; do NOT block on it. `coverStyle` is the working cover mechanism.
- **Shape** — 2-col grid of 5 selectable cards → `Program.shape`: `self_paced` · `cohort` · `one_to_one` · `workshop` · `hybrid` (matches the schema enum exactly).
- **Visibility** — `public` (join instantly) · `private` (approval-gated) → `Program.visibility`.
- **Module covers** — `gradient`/`geometric` picker (previews via `ModuleCover`) → `Program.coverStyle` (default `gradient`).
- **Continue** — disabled until `title && shape && visibility`. In the design, "Continue to builder" advances to the build stage; in our app it should **create the draft program** (POST) then route to the builder.

### `ProgramsHome` (creator home — the new post-login landing)
Props `{ programs = [] }`. Header ("Your programs" + Sign out), `Tabs` pill (`Programs` / `Cohorts` / `Needs you`).
- **Programs tab:** `ProgramCard` grid (`ModuleCover` + `Badge` `draft`/`published` + title + `{moduleCount} module(s) · {learnerCount} learner(s)`) with a **New program** button; or an `EmptyState` ("Nothing built yet" → "Create your first program"). Card click → open that program in the builder (`?open=<id>`). New program → the create flow.
- **Cohorts tab:** design shows a placeholder ("next up in the build queue"). **⚠ RECONCILE:** the shipped `apps/creator/app/DashboardClient.tsx` (Sprint 2) already has **real** invite/approve/roster here — keep the real enrollment content, do not regress to the placeholder.
- **Needs you tab:** placeholder linking to the triage queue (not this slice).

### Builder stage-2 (next slice — summary from TDD)
- `ModuleTree` — module list with per-module settings sub-panel (`description` + `unlockMode` pill row `hidden`/`immediate`/`after_previous`/`after_days` + conditional days input), inline rename, caret up/down reorder (`/move`, **not** DnD).
- `LessonEditor` — per-type field switch (text/video-embed/attachment/live/in-person), type-switch-discards-content confirmation `Modal`, per-lesson preview `Drawer` (reuses `LessonViewer`).
- `PublishBar` — draft/published state + "unpublished changes" badge (`status==='published' && updatedAt > publishedAt`) + single Publish action (blocked unless ≥1 non-`hidden` module with ≥1 lesson) + unpublish.

## Design → schema/API map (schema already migrated: `20260725093014_program_builder_content_model`)
`title`→`Program.title` · shape→`Program.shape` · visibility→`Program.visibility` · coverStyle→`Program.coverStyle` (`gradient`/`geometric`) · status→`Program.status` (`draft`/`published`, drives the Badge) · `Program.publishedAt` · `Module.description`/`unlockMode`/`unlockDays`. `moduleCount`/`learnerCount` on cards are aggregates (count modules; count active enrollments).

## Locked decisions (ADR-014 / TDD — don't re-litigate)
Draft/publish is a **gate, not a content freeze**; "unpublished changes" is a **timestamp compare** (`Program.updatedAt` must be bumped on every Module/Lesson mutation); module visibility = `unlockMode:'hidden'`; reorder = caret `/move` (no drag-and-drop); cover **image upload deferred** (no storage — ship `coverStyle` only); video **embed-only**; **quiz** lesson type out of scope.
