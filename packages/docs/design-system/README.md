# Fundi design system — audit + module backlog

This is the written output of a review of `packages/ui` against the design handoff
(`Fundi Design System.zip`: 8 token files, 9 base components, 6 `ui_kits/` of composed mockups,
14 brand guideline pages). Not a `packages/docs/features/`-style "what we built" entry (nothing
here has shipped yet) and not a ClickUp mirror (per the request, these tasks live here as
markdown, not ClickUp tickets) — this is a forward-looking backlog for the team.

See also: [`../architecture/0001-storybook-for-design-system-workflow.md`](../architecture/0001-storybook-for-design-system-workflow.md)
for the tooling recommendation these tasks assume (Storybook for isolated dev + composed-page
previews).

## Audit results (2026-07-12)

| Area | Result |
|---|---|
| **Tokens** (`packages/ui/src/tokens/*.css` vs. handoff `tokens/*.css`) | **100% match** — 97/97 custom properties verified across colors, typography, spacing, radius, shadow, layout, fonts, base. Zero missing, zero extra, zero value discrepancies. Dark-default / `[data-theme="light"]` structure matches exactly. |
| **Base components** (9: Button, Input, Card, Badge, Tag, Tabs, Modal, Drawer, EmptyState) | **100% match** — every variant, size, state, and slot from the handoff is implemented; `packages/ui/README.md`'s claims verified accurate against real source, not just trusted. A couple of reasonable implementation-side enhancements (e.g. `Input`'s `type`/`inputMode` for phone/OTP, `Tabs`' `variant` prop — the handoff's own `.d.ts` was incomplete here, implementation fixed it). |
| **Composite/feature modules** | **0/21 built.** The `ui_kits/` folder implies 21 distinct modules across 6 feature areas, each combining base components into something screen-specific — none exist in `packages/ui` yet. Full backlog below. |
| **Tooling** | No Storybook or equivalent — no way to develop/review a component or composed page in isolation. See the ADR linked above. |

Two minor **documentation** gaps found (not token bugs, don't need a dev task): the handoff's
`guidelines/iconography.html` specifies Phosphor (regular weight, CDN, 20–24px, default 22px) but
this sizing guidance isn't captured anywhere in code — worth a line in `packages/ui/README.md`'s
icon section. Similarly `guidelines/whatsapp-signature.html` describes a recurring "reminder
bubble" motif (uses the fixed `--base-whatsapp` token correctly) with no component spec — flag for
whoever picks up messaging-related UI later, not urgent now.

## Module backlog — 21 composite modules across 6 feature areas

Organized by `ui_kit` feature area (matches the design handoff's own folder structure and the
BRD/epic each belongs to). Each area's tasks are in its own file:

| File | Feature area | App | Modules |
|---|---|---|---|
| [`tasks/ai-draft-review.md`](./tasks/ai-draft-review.md) | AI Drafting & Triage (BRD) | Creator | AuditTrail, DraftQueue, DraftEditor + composed page |
| [`tasks/auth-flow.md`](./tasks/auth-flow.md) | Identity & Auth (Sprint 1) | Shared | AuthFlow + composed page |
| [`tasks/creator-triage-queue.md`](./tasks/creator-triage-queue.md) | Signals & Attention Triage (Sprint 4) | Creator | SignalBadge, ExceptionCard, FilterSortBar, ActionSheet + composed page |
| [`tasks/enrollment.md`](./tasks/enrollment.md) | Enrollment & Cohort Management (Sprint 2) | Creator | EnrollmentBadge, InviteApprove, CohortRoster + composed page |
| [`tasks/learner-progress.md`](./tasks/learner-progress.md) | Learner Progress & Lessons (Sprint 3) | Learner | ProgressHome, ModuleLessonNav, LessonViewer, LoadingStates, AssessmentFlow, HelpCapture + composed page |
| [`tasks/program-builder.md`](./tasks/program-builder.md) | Program & Curriculum Builder (BRD) | Creator | ProgramSetup, ModuleTree, LessonEditor, PublishBar + composed page |
| [`tasks/shared-utilities.md`](./tasks/shared-utilities.md) | Cross-cutting | Shared | `SIGNAL_META` port (blocks SignalBadge, FilterSortBar) |

**Build order note:** `shared-utilities.md`'s `SIGNAL_META` port is a hard prerequisite for
`SignalBadge` (creator-triage-queue), which is itself a prerequisite for `ExceptionCard` and
`ActionSheet` in the same file. `auth-flow.md`'s `AuthFlow` has no dependencies and is usable by
both apps immediately — good candidate to build first as the Storybook-workflow pilot (small
surface, real state machine, shared by both apps, directly unblocks Sprint 1's identity work
already in `packages/docs/clickup-sync/sprints/sprint-1-identity-org-design-system.md`).

Every module's task entry includes: what it is, its props/API (taken directly from the design
handoff's JSX, not re-derived), which base components it composes, its behavior/state, which app
it belongs to, and suggested acceptance criteria. Each area's file ends with a **composed-page
task** — the Storybook `pages/*.stories.tsx` equivalent of that `ui_kit`'s `index.html` mockup,
assembling the area's modules with the same demo data the handoff used.
