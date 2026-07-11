> **Source:** ClickUp — Sprints › SPRINT 2 — Program Access & Enrollment ([link](https://app.clickup.com/t/86capbyef))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

# SPRINT 2 — Program Access & Enrollment

**Release increment goal:** A Program/Cohort exists (via seeded fixtures, not the full builder UI — that's still blocked) and a creator can invite a learner by phone, see them through `pending_approval` → `active` for a private program, or straight to `active` for a public one, and view/manage a cohort roster.

**Ships & is testable as:** seed a program → invite a learner → (private) approve them → see them on the roster with the correct state badge → (public) confirm auto-active path skips approval.

**Includes (linked below):**
*   Program/Module/Lesson — minimal schema + seed fixtures (bridging story, Program & Curriculum Builder list)
*   Enrollment & Cohort Management: Invite & approve learners flow, Cohort scheduling & roster view, Enrollment state indicators, Empty/low-enrollment state

**Explicitly NOT included:** any part of the actual Program/Curriculum Builder UI (creation flow, module/lesson tree, lesson type editor, draft/publish, responsive builder) — still blocked on missing design files as of this writing. This sprint deliberately routes around that gap rather than waiting on it.

## Linked stories

### [Program & Curriculum Builder] Program/Module/Lesson — minimal schema + seed fixtures (unblocks Enrollment & Learner Progress testing)

**Why this exists:** The full Program & Curriculum Builder UI is blocked (design files missing from the handoff — see comment thread on the Program Ideation list). But Enrollment & Cohort Management and Learner Progress & Lessons both need at least one real Program/Module/Lesson to exist to be testable end-to-end. Rather than let two sprints of work sit un-testable while the builder UI catches up, this story delivers just enough backend to unblock them.

**Story:** As an engineer, I want the Program/Module/Lesson schema live (per domain model §3) with a minimal create path (API or seed script — no builder UI required), so downstream domains have something real to enroll into and progress through.

**Acceptance Criteria**
- [ ] Prisma models for Program (shape + visibility enums), Module, Lesson (ordered, typed: text/video/attachment/live_online/in_person) exist and are org-scoped (ADR-008).
- [ ] A seed script or minimal internal API can create a Program with modules/lessons for test/dev use — no creator-facing UI implied or expected here.
- [ ] At least one seeded self-paced/public and one cohort/private program exist in the dev seed data, so both Enrollment paths (auto-active vs. approval-gated) are testable.
- [ ] This story does **not** close out the "Program creation flow," "Module & Lesson builder," "Lesson type editor," or "Draft/publish states" design tasks — those remain blocked pending real design files.

Points: 5

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbyc3](https://app.clickup.com/t/86capbyc3)

---

### [Enrollment & Cohort Management] Invite & approve learners flow

**Design:** [https://app.clickup.com/t/86cap8ng1](https://app.clickup.com/t/86cap8ng1) (`InviteApprove.jsx`)
**Technical direction:** ADR-001 (phone-number-first identity), domain model §3 (Enrollment states: `pending_approval`/`active`/`completed`/`dropped`), Program _visibility_ enum (`public`/`private`).

**User story:** As a mentor, I want to invite a learner by phone number and, for private/approval-gated programs, approve or decline them before they're active, so I control who's in a paid or gated cohort while public programs stay frictionless.

**Acceptance criteria:**
*   Invite form takes a phone number only (phone-first identity per ADR-001), sends invite.
*   **Private programs**: invited learner lands in `pending_approval`; mentor sees a pending list with Approve/Decline actions; approving moves them to `active`.
*   **Public programs**: invite (or self-serve join, if in scope for this program type) skips straight to `active` — no approval step shown.
*   Decline removes the pending entry (does not silently leave a dangling state).
*   Invalid/malformed phone number is rejected client-side before submit.

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbvdy](https://app.clickup.com/t/86capbvdy)

---

### [Enrollment & Cohort Management] Cohort scheduling & roster view

**Design:** [https://app.clickup.com/t/86cap8ng9](https://app.clickup.com/t/86cap8ng9) (`CohortRoster.jsx`)
**Technical direction:** domain model §3 (Cohort · Enrollment entity, Program _shape_ enum including `self_paced`/`cohort`).

**User story:** As a mentor, I want to see my cohorts as tabs and view/manage each one's roster, so I can work with one scheduled group at a time (or a single rolling self-paced track) without the rosters blending together.

**Acceptance criteria:**
*   Cohort tabs show name + learner count (monospace count per brand type rules); active tab is visually distinct.
*   Self-paced programs show a single rolling roster (no cohort-tab switching needed) — confirm with design whether this is a hidden single-tab or a genuinely different layout; not fully specified in the current kit.
*   Roster list shows each learner with their `EnrollmentBadge` (state) — see that story for the badge itself.
*   Switching cohorts doesn't reload the whole screen — tab state only.

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbve6](https://app.clickup.com/t/86capbve6)

---

### [Enrollment & Cohort Management] Enrollment state indicators

**Design:** [https://app.clickup.com/t/86cap8ngf](https://app.clickup.com/t/86cap8ngf) (`EnrollmentBadge.jsx`)
**Technical direction:** domain model §3 — Enrollment _state_ enum is exactly `pending_approval | active | completed | dropped`.

**User story:** As a mentor scanning a roster or dashboard, I want each learner's enrollment state shown as a consistent badge, so I can tell at a glance who's pending, active, done, or dropped.

**Acceptance criteria:**
*   Four states map to: `pending_approval` → warn/hourglass, `active` → live/check, `completed` → draft-tone/flag, `dropped` → neutral/x — matching the design system's Badge tone set exactly.
*   Badge supports a `compact` mode (icon-only, no label) for dense layouts (e.g. desktop table view of the triage/roster).
*   Reused everywhere an enrollment appears (roster, program dashboard) — not reimplemented per screen.

**Status:** backlog · **Priority:** high · **ClickUp:** [86capbven](https://app.clickup.com/t/86capbven)

---

### [Enrollment & Cohort Management] Empty / low-enrollment state

**Design:** [https://app.clickup.com/t/86cap8nh3](https://app.clickup.com/t/86cap8nh3)
**Technical direction:** shared `EmptyState` primitive.

**User story:** As a mentor with a brand-new or barely-filled cohort, I want the roster to look intentional rather than broken when there are 0-few learners, so the app feels finished even on day one.

**Acceptance criteria:**
*   0 learners: `EmptyState` with a clear call-to-action pointing at "Invite a learner" (this story's empty state should link/scroll to the Invite & Approve flow).
*   1-few learners (low-enrollment, not zero): roster renders normally — confirm with design the exact threshold where "low" styling (if any beyond just fewer rows) kicks in, since the design file doesn't define a distinct in-between state beyond the zero case.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbvey](https://app.clickup.com/t/86capbvey)

---

### [Product Documentations] Process: Sprint completion → release-increment doc

> **Note:** this linked item is a cross-cutting process doc (list: "Product Documentations", not a domain/epic list), linked to multiple sprints (linked_tasks_count: 4 on the source task), not a Sprint-2-specific delivery story. Included here verbatim because it appeared among the 6 linked tasks on the Sprint 2 umbrella task.

**Process:** When a Sprint (in the Sprints folder) is fully done — every linked story shipped and tested per the sprint task's "ships & is testable as" criteria — do the following instead of just leaving it sitting closed in the folder:

1. **Write a short release-increment doc** covering: what shipped (the story list, as already linked on the sprint task), what got tested and how, any decisions/deviations made mid-sprint that weren't in the original story ACs, and any follow-on items it surfaced (bugs, "later" items, new spikes). This lives in **Product Documentations**, one doc per sprint.
2. **Close the sprint task** in its Sprints-folder list once the doc exists and is linked back from the sprint task (and the doc links back to the sprint task).
3. The underlying story tasks stay in their domain lists (Signals & Attention Triage, Enrollment & Cohort Management, etc.) at whatever status reflects reality (`shipped`/closed) — the sprint task closing doesn't change those, it's just the release-increment wrapper.

This keeps the Sprints folder as a live view of what's in-flight/next, while Product Documentations accumulates the actual record of what shipped and why — useful for onboarding, and for reconstructing "why did we build it that way" later.

**Current state (2026-07-11):** Sprints 1–4 are all open, nothing shipped yet, so nothing to convert yet. Applies going forward as each one closes out.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbyng](https://app.clickup.com/t/86capbyng)

---
