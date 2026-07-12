# Learner progress & lessons

Maps to Sprint 3 (`packages/docs/clickup-sync/sprints/sprint-3-learner-progress-lessons.md`). The
largest single feature area (6 modules) — deliberately **thin** per ADR-012's "learner bundle
stays genuinely thin" (Positive consequence): none of these should pull in creator-only code, and
`packages/ui`'s `modules/` split (see `auth-flow.md`) matters most here since the Next.js
bundle-isolation check already proven in Task 7 only protects `apps/*`, not `packages/ui` itself —
these modules are the first real test of whether `packages/ui` stays clean of that cross-app leak
risk too. Build order: `LessonViewer` and `ModuleLessonNav` first (core navigation), others
parallelizable.

---

## Task: Build `ProgressHome` module

**What it is:** The learner's "where am I" entry point — described in the handoff as "not a feed,
more like a flight-status page." Current module, progress %, streak, and a "continue" card for the
next lesson.

**Location:** `packages/ui/src/modules/ProgressHome.tsx`

**Props/API:**
```ts
interface ProgressHomeProps {
  program: string;
  currentModule: string;
  nextUp: { title: string; meta: string };
  percent: number;      // 0-100
  streakDays: number;
  onOpenCurrent: () => void;
}
```

**Composition:** `Card` (`interactive`), `Button` (primary, sm, "Continue"). Custom pill-shaped
progress bar.

**Acceptance criteria:**
- [ ] Progress bar width accurately reflects `percent` (including 0 and 100 edge cases).
- [ ] "Up next" card click and its Continue button both fire `onOpenCurrent()`.
- [ ] Storybook stories: low progress, near-complete, zero streak.

---

## Task: Build `ModuleLessonNav` module

**What it is:** Drip-aware navigator listing all modules/lessons, with **locked future lessons
still visible** (grayed, lock icon) — pacing is legible without exposing scheduling internals, per
the handoff's own framing.

**Location:** `packages/ui/src/modules/ModuleLessonNav.tsx`

**Props/API:**
```ts
interface ModuleLessonNavProps {
  modules: Array<{
    title: string;
    status?: string;    // e.g. "Live"
    lessons: Array<{ title: string; type: LessonType; locked?: boolean; meta: string }>;
  }>;
  onOpenLesson: (lesson: { title: string; type: LessonType }) => void;
}
```

**Composition:** `Badge` for module status. Per-lesson: type-specific Phosphor icon (or lock icon
if `locked`), title, meta text, caret-right.

**Behavior:** Locked lessons render at reduced opacity (0.45) and are **not** clickable — this is
a real interaction-blocking state, not just a visual dim.

**Acceptance criteria:**
- [ ] Locked lessons genuinely don't fire `onOpenLesson` on click/tap (not just visually styled).
- [ ] Each `LessonType` (text/video/attachment/live_online/in_person) maps to a distinct icon.
- [ ] Storybook stories: mixed locked/unlocked, a module with a status badge, all lesson types.

---

## Task: Build `LessonViewer` module

**What it is:** Per-lesson-type content viewer — the actual "consume a lesson" surface, one of the
five §6 lesson types from the product brief. Every type ends in the same "Mark done" action.

**Location:** `packages/ui/src/modules/LessonViewer.tsx`

**Props/API:**
```ts
type Lesson =
  | { type: 'text'; title: string; moduleTitle: string; body: string }
  | { type: 'video'; title: string; moduleTitle: string; duration: string }
  | { type: 'attachment'; title: string; moduleTitle: string; name: string; size: string }
  | { type: 'live_online' | 'in_person'; title: string; moduleTitle: string; when: string; where: string };

interface LessonViewerProps {
  lesson: Lesson;
  onDone: () => void;
}
```

**Composition:** `Button` (primary "Mark done"), `Card` (attachment type), `Badge` (live-session
indicator). Type-specific rendering per the discriminated union above — this is the module where
getting the type-narrowing right in TypeScript actually matters, since each branch has genuinely
different fields.

**Note:** the handoff's video/attachment rendering is a static placeholder (no real
playback/download) — this task is the viewer chrome only; wiring real video embed / file download
is separate, tracked against the "Media hosting depth" open question already flagged in the
product ADR §12.

**Acceptance criteria:**
- [ ] All 5 lesson types render their distinct layout correctly from the same `lesson` prop.
- [ ] "Mark done" present and calls `onDone()` regardless of type.
- [ ] Storybook stories: one per lesson type.

---

## Task: Build `LoadingStates` module

**What it is:** Three low-bandwidth states directly serving §7's Africa-market constraints
(bandwidth, connectivity): a video-loading progress indicator, a retry-on-failure state, and an
offline banner.

**Location:** `packages/ui/src/modules/LoadingStates.tsx` (exports 3 named components:
`VideoLoading`, `RetryState`, `OfflineBanner`)

**Props/API:**
```ts
interface VideoLoadingProps { percent: number; }        // 0-100
interface RetryStateProps { what: string; onRetry: () => void; }  // "the worksheet"
// OfflineBanner: no props
```

**Composition:** `VideoLoading`: spinner (CSS keyframe rotation — carry over the handoff's exact
`@keyframes fundi-spin`) + progress bar. `RetryState`: `Button` (secondary, sm, retry icon).
`OfflineBanner`: static warning row.

**Acceptance criteria:**
- [ ] Spinner animation present and smooth (not just a static icon).
- [ ] `RetryState`'s button correctly fires `onRetry()`.
- [ ] Storybook stories for all three, `VideoLoading` at multiple `percent` values.

---

## Task: Build `AssessmentFlow` module

**What it is:** In-app multi-question quiz — single-question-at-a-time flow with an
auto-advancing pick interaction and a pass/fail result screen (≥70% = pass, per the handoff).

**Location:** `packages/ui/src/modules/AssessmentFlow.tsx`

**Props/API:**
```ts
interface AssessmentFlowProps {
  questions: Array<{ prompt: string; options: string[]; correct: number }>;
}
```

**Composition:** `Button`, `Card` (each option is a clickable Card), `Badge` (pass/fail tone: live
for pass, danger for fail).

**Behavior:** Internal state: current question index, answers array, `done` flag. Clicking an
option Card auto-advances (no separate "submit" step) — the handoff deliberately has no submit
button per question. On the last question, computes score and shows the result screen.

**Acceptance criteria:**
- [ ] Auto-advance works correctly through all questions with no submit step.
- [ ] Score calculation and pass/fail threshold (≥70%) match the handoff exactly.
- [ ] Storybook stories: 100% pass, 100% fail, borderline (~70%) result.

---

## Task: Build `HelpCapture` module (+ `HelpButton`)

**What it is:** The ADR-003a in-app "ask for help" affordance — **not chat**, a structured capture
form that emits a `help_requested` Signal to the mentor's queue. The mentor's actual reply still
goes out over WhatsApp; this module never hosts live conversation, per ADR-003/ADR-003a.

**Location:** `packages/ui/src/modules/HelpCapture.tsx` (exports both `HelpButton`, a fixed FAB,
and `HelpCapture`, the drawer it opens)

**Props/API:**
```ts
interface HelpCaptureProps {
  open: boolean;
  onClose: () => void;
  lessonContext?: string;
  whatsappNumber?: string;   // fallback wa.me deep-link, per ADR-003a's "worth keeping alongside"
}
```

**Composition:** `HelpButton`: fixed teal circular FAB, hand-waving icon. `HelpCapture`: wraps
`Drawer` (`heightPercent="70%"`), `Button` (primary "Send request").

**Behavior:** Local `message`/`sent` state, both reset whenever the drawer opens. Pre-send: textarea
+ disabled-until-non-empty "Send request" button + a secondary `wa.me/` deep-link as the ADR-003a
fallback. Post-send: success confirmation (checkmark, "Your mentor's been notified"), footer
collapses to a single "Done" button.

**Real-backend note:** this task is the capture UI + local success-state simulation only. Actually
emitting the `help_requested` Signal (ADR-010) on send is backend wiring, tracked as part of
Sprint 3/4's own backend stories — this module should expose an `onSubmit(message): Promise<void>`
prop (resolving → `sent = true`) rather than hardcoding the demo's instant local state flip, so the
real Signal-emission call slots in cleanly later.

**Acceptance criteria:**
- [ ] `HelpButton` FAB is fixed-position and always accessible from wherever it's mounted.
- [ ] Send disabled until non-empty message; success state renders correctly post-send.
- [ ] Component takes an injectable async submit handler rather than a hardcoded local flip.
- [ ] Storybook stories: pre-send, sending, sent, with/without `lessonContext`.

---

## Task: Composed-page story — "Progress & Lessons" (Learner)

**What it is:** Storybook equivalent of `ui_kits/learner-progress/index.html` — the full
stack-navigation flow: Home (`ProgressHome`) → Lessons list (`ModuleLessonNav`) →
Viewer/Quiz (`LessonViewer`/`AssessmentFlow`), plus a states-demo panel
(`OfflineBanner`/`VideoLoading`/`RetryState`) and the floating `HelpButton`/`HelpCapture` reachable
from every screen in the stack.

**Do:** `packages/ui/src/pages/LearnerProgress.stories.tsx`. Reuse the handoff's demo data (3
modules / 6 lessons / 1 quiz / 1 locked live session). Implement the stack-nav as local story
state (a simple `screen` state: `'home' | 'lessons' | 'viewer' | 'quiz'`), not real routing —
that's `apps/learner`'s job once these modules land there for real.

**Acceptance criteria:**
- [ ] Full navigation stack works: home → lessons → open a lesson → mark done → back to lessons;
      home → open quiz → complete → result.
- [ ] `HelpButton` reachable and functional from every screen in the stack.
- [ ] States-demo panel (offline/loading/retry) reachable via a dedicated story or control, not
      just buried inside the main flow.
