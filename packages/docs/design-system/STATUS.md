# Fundi design system — build status

> **Local (non-ClickUp) tracker.** ClickUp-synced *delivery* stories live in `../clickup-sync/`;
> everything here — the module backlog **and** the engineering/tooling topics from
> [ADR-ENG-0001](../architecture/0001-storybook-for-design-system-workflow.md) and the build
> sessions — is tracked as markdown, not ClickUp (per the original request). The per-area
> `tasks/*.md` files hold the detailed specs/ACs; this file is the at-a-glance "what's done / what's
> left." Keep the checkboxes current as work lands.

## Foundations & tooling
- [x] Storybook (`@storybook/nextjs`) wired into `packages/ui` — ADR-ENG-0001
- [x] Base component stories (all 9 primitives)
- [x] Overlay a11y — shared `useDialogA11y` (focus trap / Escape / restore) on `Modal`, `Drawer`
- [x] CI: `build-storybook` turbo task gates PRs (`ci.yml`) + `Deploy Storybook (Dev)` workflow → Render static site (`render.yaml`)
  - [ ] **One-time manual:** create the `fundi-storybook` Render site from the Blueprint + add `RENDER_STORYBOOK_SERVICE_ID` to the `dev` GitHub Environment (publish step is dormant until then)
- [x] Responsive: CSS Modules adopted + SSR-safe `useBreakpoint()`; `CohortRoster` (card↔table) + `InviteApprove` (phone-stack) converted as exemplars
  - [ ] Incremental: migrate remaining inline-styled components/modules to CSS Modules as they need breakpoints or `:hover`/`:focus` (e.g. base components' hand-rolled JS hover state)

## Shared primitives & utilities (`packages/ui/src`)
- [x] Metadata + pure helpers (unit-tested): `SIGNAL_META`, `ENROLLMENT_META`, `initials`, `formatRelativeTime`, `useBreakpoint`
- [x] `Spinner`, `ProgressBar`, `AvatarInitial`, `RelativeTime`, `Fab` (`components/`)
- [x] `MessageComposer` (`modules/`) — shared edit-then-send

## Module chains (`packages/ui/src/modules/`)
- [x] **Auth** — `AuthFlow`, `OtpInput`
- [x] **Creator triage queue** — `SignalBadge`, `ExceptionCard`, `ExceptionTableRow`, `SnoozePicker`, `ActionSheet`, `FilterTagRow`, `SortToggle`, `FilterSortBar`
- [x] **Enrollment** — `EnrollmentBadge`, `PendingInviteRow`, `CohortTab`, `RosterRow`, `InviteApprove`, `CohortRoster`
- [x] **AI draft review** — `DraftCard`, `VariableChip`, `AuditRow`, `DraftQueue`, `DraftEditor`, `AuditTrail`
- [ ] **Program builder** — items `SelectableOptionCard`, `ModuleBlock`, `LessonRow`, `LessonTypeSelector`, `FileDropZone` → `ProgramSetup`, `ModuleTree`, `LessonEditor`, `PublishBar` (+ `LearnerPreview`). ⚠ Confirm design-file availability first (see `tasks/program-builder.md`). Strong test of the responsive CSS-Modules approach (desktop split-panel ↔ mobile single-column).
- [ ] **Learner progress** — items `LessonNavRow`, `QuizOptionCard`, `AssessmentResult`, `HelpButton` → `ProgressHome`, `ModuleLessonNav`, `LessonViewer`, `LoadingStates` (`VideoLoading`/`RetryState`/`OfflineBanner`), `AssessmentFlow`, `HelpCapture`

## App screens (assembled in `apps/*`, not `packages/ui`)
Per ADR-ENG-0001 the full screens live in the apps; each area's `tasks/*.md` ends with an app-screen task.
- [ ] Auth (creator + learner) · [ ] Program builder (creator) · [ ] Enrollment & roster (creator)
- [ ] "Needs You" queue (creator) · [ ] Progress & lessons (learner) · [ ] AI draft review (creator)

## Known follow-ups
- [ ] a11y beyond overlays: some interactive elements are click-only `span`s (e.g. `Tag`) — give them button semantics / keyboard support when hardened
- [ ] Wire `build-storybook` publish for staging/prod when those environments exist (Dev is set up)

**Verify a chunk of work:** `pnpm --filter @fundi/ui lint` · `pnpm --filter @fundi/ui test` · `pnpm --filter @fundi/ui build-storybook` · app-equivalent typecheck · `pnpm --filter @fundi/creator exec tsc --noEmit -p tsconfig.json`.
