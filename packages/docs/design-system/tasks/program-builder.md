# Program & curriculum builder

Maps to the "BRD: Program & Curriculum Builder" and the largest, most stateful creator surface.
Note per `packages/docs/clickup-sync/sprints/sprint-2-program-access-enrollment.md`: the full
builder UI is currently **blocked on missing design files** for some pieces (per that sprint doc's
own note) — this task set covers exactly what the handoff *does* provide; confirm against the
latest design status before starting in case that block has since lifted with more files. Build
order: `ProgramSetup` first (no dependencies, gates entry to the rest), `ModuleTree` +
`LessonEditor` together (tightly coupled — selection in one drives the other), `PublishBar` last
(depends on having a `program` shape to display).

---

## Task: Build `ProgramSetup` module

**What it is:** Initial program-creation form — title, shape (self-paced/cohort/one-to-one/
workshop/hybrid, per product brief §7), and visibility (public/private-approval-gated, §10).

**Location:** `packages/ui/src/modules/ProgramSetup.tsx`

**Props/API:**
```ts
interface ProgramSetupProps {
  value: { title: string; shape: ProgramShape | null; visibility: ProgramVisibility | null };
  onChange: (value: ProgramSetupProps['value']) => void;
  onContinue: () => void;
}
```

**Composition:** `Input` (title). Custom multi-select grids for shape (2-col, 5 options with icon +
label + description each) and visibility (1-col, 2 options) — selection state toggles between an
accent-soft background + primary border vs. plain surface + subtle border.

**Behavior:** "Continue to builder" disabled until all three fields (`title`, `shape`,
`visibility`) are set.

**Acceptance criteria:**
- [ ] All 5 `ProgramShape` and both `ProgramVisibility` options selectable with correct visual
      selected-state.
- [ ] Continue button correctly gated on all-fields-set.
- [ ] Storybook stories: empty, partially filled, fully filled.

---

## Task: Build `ModuleTree` module

**What it is:** The builder's core canvas — collapsible modules containing reorderable lessons,
with add/rename/reorder actions. Selecting a lesson here drives what `LessonEditor` shows.

**Location:** `packages/ui/src/modules/ModuleTree.tsx`

**Props/API:**
```ts
interface ModuleTreeProps {
  modules: Array<{ id: string; title: string; lessons: Array<{ id: string; title: string; type: LessonType }> }>;
  activeLessonId: string | null;
  onSelectLesson: (id: string) => void;
  onMoveLesson: (moduleId: string, lessonIndex: number, direction: 'up' | 'down') => void;
  onMoveModule: (index: number, direction: 'up' | 'down') => void;
  onAddLesson: (moduleId: string) => void;
  onAddModule: () => void;
  onRenameModule: (moduleId: string, title: string) => void;
}
```

**Composition:** Internal `ModuleBlock` (collapsible, inline-editable title) and `LessonRow`
(type icon, title, up/down reorder arrows) sub-components. `EmptyState` + `Button` when
`modules.length === 0`.

**Behavior:** Inline title editing: click to edit, Enter/blur commits via `onRenameModule`, Escape
cancels without calling it. Reorder arrows disabled at list boundaries (first module's "up",
last module's "down", etc.).

**Acceptance criteria:**
- [ ] Inline rename: Enter and blur both commit, Escape reverts without firing the callback.
- [ ] Reorder arrows correctly disabled at boundaries, correctly call `onMoveModule`/`onMoveLesson`
      with the right direction otherwise.
- [ ] Zero-modules empty state present.
- [ ] Storybook stories: multiple modules with lessons, single empty module, zero modules.

---

## Task: Build `LessonEditor` module

**What it is:** The panel that edits whatever lesson `ModuleTree` has selected — field set changes
entirely based on lesson type.

**Location:** `packages/ui/src/modules/LessonEditor.tsx`

**Props/API:**
```ts
interface LessonEditorProps {
  lesson: {
    id: string; title: string; type: LessonType;
    body?: string;                              // text
    embedUrl?: string; duration?: string;        // video
    fileName?: string;                           // attachment
    when?: string; where?: string; notes?: string; // live_online / in_person
  } | null;
  onChange: (updated: LessonEditorProps['lesson']) => void;
  onDelete: () => void;
}
```

**Composition:** `Input`, `Button`, `Tag` (5-option type selector pill row), a custom textarea, a
dashed-border file-drop zone (attachment type).

**Behavior:** Shows "Select a lesson to edit" placeholder when `lesson === null`. Type selector
switches which field group renders (text→textarea; video→embed URL + duration inputs + a helper
note that video hosting depth is still an open product question per ADR §12; attachment→file drop
zone; live_online/in_person→when/where/notes). Every field edit calls
`onChange({ ...lesson, [key]: value })`.

**Acceptance criteria:**
- [ ] Field set correctly swaps per `lesson.type`, preserving type-appropriate fields only.
- [ ] Null-lesson placeholder state present and correct.
- [ ] Delete icon calls `onDelete()`.
- [ ] Storybook stories: one per lesson type, plus the null/placeholder state.

---

## Task: Build `PublishBar` module (+ `LearnerPreview`)

**What it is:** Top bar for the builder session (title, draft/published status, preview toggle,
publish action) plus a read-only `LearnerPreview` showing the program structure as a learner would
see it — the builder's "what does this look like to them" check before publishing.

**Location:** `packages/ui/src/modules/PublishBar.tsx` (exports `PublishBar` and `LearnerPreview`)

**Props/API:**
```ts
interface PublishBarProps {
  program: { title: string; status: 'draft' | 'published'; modules: unknown[] };
  previewOn: boolean;
  onTogglePreview: () => void;
  onPublish: () => void;
}
interface LearnerPreviewProps {
  program: PublishBarProps['program'];
}
```

**Composition:** `PublishBar`: `Button` (primary/secondary, sm), `Badge` (live/draft tone).
`LearnerPreview`: read-only module/lesson list with type icons, no interactivity.

**Behavior:** Preview button toggles `previewOn` (label switches "Preview" ⇄ "Exit preview",
variant switches to primary when active). Publish button hidden/disabled once
`status === 'published'`.

**Acceptance criteria:**
- [ ] Preview toggle label/variant switch correctly.
- [ ] Publish button correctly hidden/disabled post-publish.
- [ ] `LearnerPreview` renders full structure with zero interactive affordances (confirm nothing
      is accidentally clickable).
- [ ] Storybook stories: draft state, published state, preview-on.

---

## Task: App screen — "Program Builder" (Creator)

**What it is:** The real builder screen in **`apps/creator`** (e.g. `app/programs/[id]/build/`) —
two-stage flow (`ProgramSetup` → split-panel builder with `ModuleTree` left / `LessonEditor` right,
`PublishBar` on top, `LearnerPreview` overlaying in preview mode), desktop-primary but responsive
down to mobile single-column. `ui_kits/program-builder/index.html` is the design reference.

**Do:** Assemble the modules in the creator app, wiring their callbacks to real program state/data.
Left/right panels scroll independently on desktop; single-column stack on mobile.

**Acceptance criteria:**
- [ ] Setup → builder transition works correctly (setup can't be skipped without all 3 fields).
- [ ] Desktop split-panel and mobile single-column layouts both match the handoff.
- [ ] Preview mode correctly swaps the builder canvas for `LearnerPreview`.

---

## Item & composition modules

Finer pieces the feature modules above compose (all in `packages/ui/src/modules/`, co-located story each):

- **`SelectableOptionCard`** (I) — one selectable option (icon + label + description) with selected
  vs. plain styling. Props: `{ icon?; label; description?; selected; onSelect }`. `ProgramSetup`
  renders a grid of these for shape (5) and visibility (2). AC: selected (accent-soft bg + primary
  border) vs. plain; story both.
- **`ModuleBlock`** (I) — collapsible module container with inline-editable title + add/reorder
  controls, wrapping its `LessonRow` children. Props: `{ title; collapsed?; onToggle; onRename;
  onAddLesson; onMoveUp?; onMoveDown?; children }`. Enter/blur commit rename, Escape cancels.
- **`LessonRow`** (I) — a lesson line: type icon + title + up/down reorder arrows. Props:
  `{ title; type: LessonType; active?; onSelect; onMoveUp?; onMoveDown? }`. Arrows disabled at
  boundaries. AC: correct icon per `LessonType`.
- **`LessonTypeSelector`** (C) — the 5-option lesson-type pill row (`Tag`s). Props:
  `{ value: LessonType; onChange }`. Used by `LessonEditor`.
- **`FileDropZone`** (C) — dashed-border file drop/browse area (attachment lessons). Props:
  `{ fileName?; onFile }`. Chrome only (no real upload yet).
