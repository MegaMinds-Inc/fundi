> **Source:** ClickUp — Sprints › Sprint 4 ([link](https://app.clickup.com/t/86capbyga)) — note: this task lives in the "Sprint 1" ClickUp list, not its own list, due to a workspace list-limit (see the task's own description).
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

# Sprint 4 — Needs You / Attention Triage (help_requested slice)

**Note:** hit this workspace's list-limit-per-space on the plan, so Sprint 4 lives here alongside Sprint 1 rather than as its own list (Sprint 2 and Sprint 3 got their own lists just before the limit hit). Functionally identical — this is still a distinct release increment, just grouped by task rather than by list. Worth asking whoever owns the ClickUp plan whether to bump the list limit or archive an unused list (e.g. the old "Team Space" sample lists) to free one up.

**Release increment goal:** A mentor's "Needs You" queue works end-to-end for at least one real Signal type — `help_requested`, which Sprint 3 makes fully real (learner submits → Signal fires). Other Signal types (`lesson_overdue`, `reminder_unacknowledged`, `quiz_failed`, `went_quiet`) will populate the same UI once their producers exist (Scheduling/Drip Engine, WhatsApp inbound events) — not yet sequenced, see final note.

**Ships & is testable as:** learner submits a help request (Sprint 3) → it appears in the mentor's queue as an Exception card with the correct SignalBadge → mentor filters/sorts → opens it → sends a reply / resolves / snoozes (3/1/7-day picker) → card leaves the queue. Empty state shows correctly when nothing's pending. Layout adapts correctly across mobile/tablet/desktop.

**Includes (linked below):**
*   Exception card component
*   Ranking & explainability pattern
*   Take-action flow from a queue item
*   Empty state — "no one needs you"
*   Filter & sort controls
*   Responsive adaptation (tablet/mobile)
*   SPIKE: Design pass — specific triage rule set (this needs resolving _during_ this sprint, not before — it determines the scoring function behind "Ranking & explainability")

**Depends on:** Sprint 3 (help_requested signal source).

## Linked stories

### [Signals & Attention Triage] SPIKE: Design pass — specific triage rule set

**Goal:** ADR-010 locks the _mechanism_ (Signal stream + rules scoring); the actual rules — thresholds, which signals combine, how staleness is weighted — still need a focused design pass with product.

**Deliverable:** Documented rule set (which Signal types, combination logic, scoring weights) ready to hand to engineering before Signals & Attention Triage stories are written. This is a design/product session, not solo research — schedule time with the PO.

**Status:** backlog · **Priority:** high · **ClickUp:** [86cap8tqk](https://app.clickup.com/t/86cap8tqk)

---

### [Signals & Attention Triage] Exception card component (Needs You queue)

**Design:** [https://app.clickup.com/t/86cap5jc2](https://app.clickup.com/t/86cap5jc2) (`ExceptionCard.jsx`, `SignalBadge.jsx`)
**Technical direction:** ADR-010 (Signal stream + rules-based scoring) — TDD not yet written; actual rule set (thresholds, staleness weighting) is still an open question per §12 of the ADR and needs a design pass with product before the scoring function is implemented. This story covers the **card UI**, not the scoring logic.

**User story:** As a mentor viewing my "Needs You" queue, I want each learner exception shown as a self-contained card with the signal that triggered it, so I immediately understand _why_ someone surfaced without digging further.

**Acceptance criteria:**
*   Card shows learner name, cohort, a `SignalBadge` (icon + tone + label) for the Signal type that fired, staleness ("Xh/Xd ago"), and a one-line suggested action.
*   One Signal type per card in v1 — if a learner has multiple open Signals, card shows the most severe/recent one (exact precedence rule to be confirmed alongside the scoring-function work in ADR-010's open item).
*   Card is tappable/clickable to open the take-action flow (separate story).
*   Tone mapping matches the 5 Signal types: `lesson_overdue`, `reminder_unacknowledged`, `quiz_failed`, `help_requested`, `went_quiet`.
*   No hidden score anywhere in the UI — the badge itself is the full explanation, per ADR-010's explainability requirement.

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbvcm](https://app.clickup.com/t/86capbvcm)

---

### [Signals & Attention Triage] Ranking & explainability pattern (Needs You queue)

**Design:** [https://app.clickup.com/t/86cap5jbr](https://app.clickup.com/t/86cap5jbr) (`SignalBadge.jsx` + queue ordering in `ui_kits/creator-triage-queue/index.html`)
**Technical direction:** ADR-010. TDD not yet written — depends on the same rule-set design pass noted in the Exception Card story.

**User story:** As a mentor, I want the "Needs You" queue ranked so the most urgent exceptions are at the top, and I want to be able to see why any given ranking happened, so I trust the queue enough to act on it without double-checking.

**Acceptance criteria:**
*   Queue order is driven by the rules-based scoring pass (backend, per ADR-010) — frontend renders in the order the API returns, doesn't re-sort client-side except via the explicit sort control (separate story).
*   Every card's "why" is visible without a click (the SignalBadge) — no drill-down required to see the triggering Signal.
*   If two Signal types apply to the same learner, only one badge is surfaced per the precedence rule (tracked as an open item, same as Exception Card story).
*   Ranking updates live/on-refresh as new Signals fire or existing ones are resolved — exact refresh strategy (poll vs. push) is a backend/infra decision, not scoped here.

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbvcq](https://app.clickup.com/t/86capbvcq)

---

### [Signals & Attention Triage] Take-action flow from a queue item

**Design:** [https://app.clickup.com/t/86cap5jcq](https://app.clickup.com/t/86cap5jcq) (`ActionSheet.jsx`)
**Technical direction:** ADR-003/ADR-003a (Fundi never hosts live conversation — acting on a card means deep-linking to WhatsApp), ADR-005 (message templating), ADR-011 (human approval before send).

**User story:** As a mentor, when I open an exception card, I want one place to either send an AI-drafted reply, mark it resolved, or snooze it, so handling an exception takes one tap-through instead of leaving the app.

**Acceptance criteria:**
*   Bottom drawer (using the core `Drawer` primitive) shows: learner/cohort/signal context, an editable AI-drafted message (subject to the compliance fix tracked on the AI Draft Review "Edit-before-send draft editor" design task — this story's send action must route through whatever editor contract that resolves to), and three actions: **Send** (via WhatsApp per ADR-004 channel abstraction), **Mark resolved**, **Snooze**.
*   **Snooze** opens a duration picker: 1 day / 3 days / 1 week, with 3 days as the default — per the design-pass decision already flagged to PO on the BRD (confirmed, no changes requested).
*   Resolving or sending updates the Signal/queue state so the card leaves the "Needs You" list once handled.
*   No live chat UI anywhere in this flow — sending an approved draft is a one-way handoff to WhatsApp, consistent with ADR-003.

**Status:** backlog · **Priority:** high · **ClickUp:** [86capbvcy](https://app.clickup.com/t/86capbvcy)

---

### [Signals & Attention Triage] Empty state — "no one needs you"

**Design:** [https://app.clickup.com/t/86cap5jc6](https://app.clickup.com/t/86cap5jc6)
**Technical direction:** ADR-010; uses the shared `EmptyState` design-system primitive.

**User story:** As a mentor with no open exceptions, I want the queue to clearly tell me everyone's on track, so I don't wonder whether the queue is broken or just empty.

**Acceptance criteria:**
*   Zero-Signal state renders the shared `EmptyState` component (icon + heading + body), not a blank screen.
*   Copy reassures the mentor the system is working ("no one needs you right now" register, not "no data").
*   State is reachable in the live demo/dev environment by clearing all Signals for a test cohort.

**Status:** backlog · **Priority:** high · **ClickUp:** [86capbvd1](https://app.clickup.com/t/86capbvd1)

---

### [Signals & Attention Triage] Filter & sort controls

**Design:** [https://app.clickup.com/t/86cap5jdq](https://app.clickup.com/t/86cap5jdq) (`FilterSortBar.jsx`)
**Technical direction:** ADR-010.

**User story:** As a mentor running several cohorts, I want to filter the queue by Signal type and sort by staleness, so a busy queue stays usable once I'm past 1-2 exceptions.

**Acceptance criteria:**
*   Filter row lets a mentor select "All" or a single Signal type (pill/tag style, matches design system `Tag` component); selecting a type filters the visible cards client-side or via API param (backend's call).
*   Sort toggle between "Most stale" / "Least stale" (labels as designed, not raw "newest/oldest").
*   Result count ("N need you") updates live with the active filter.
*   Bar stays a single low-key row per the design intent — this is a secondary control, not a primary navigation element.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbvd5](https://app.clickup.com/t/86capbvd5)

---

### [Signals & Attention Triage] Responsive adaptation (tablet/mobile) — Needs You queue

**Design:** [https://app.clickup.com/t/86cap5jfj](https://app.clickup.com/t/86cap5jfj) — device switcher demo in `ui_kits/creator-triage-queue/index.html` (Mobile 390 / Tablet 820 / Desktop 1200)
**Technical direction:** ADR-012 §8 ("adapt, don't just shrink").

**User story:** As a mentor on any device, I want the Needs You queue to use my screen well, so I'm not scrolling a cramped mobile layout on desktop or a horizontally-scrolling table on mobile.

**Acceptance criteria:**
*   Mobile (0–767px): single-column card stack.
*   Tablet (768–1199px): 2-up card grid.
*   Desktop (1200px+): dense table view (adapted shape, not a shrunk card stack).
*   Breakpoints match `tokens/layout.css` values exactly — hardcode into media queries per the design system's own guidance (CSS vars aren't valid in `@media` conditions).
*   All three layouts expose the same actions (open, snooze, resolve) — only density/shape changes, not functionality.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbvdk](https://app.clickup.com/t/86capbvdk)

---

### [Product Documentations] Process: Sprint completion → release-increment doc (cross-cutting, not a delivery story)

Linked from all four sprints (1–4), not specific to Sprint 4 — included here for completeness since it's a real linked task, not a duplicate/self-reference (an earlier sync pass incorrectly treated the ambiguous `task_id`/`link_id` pairing on this entry as self-referential and dropped it; verified by direct fetch that it's a distinct task).

**Process:** When a Sprint (in the Sprints folder) is fully done — every linked story shipped and tested per the sprint task's "ships & is testable as" criteria — do the following instead of just leaving it sitting closed in the folder:

1. **Write a short release-increment doc** covering: what shipped (the story list, as already linked on the sprint task), what got tested and how, any decisions/deviations made mid-sprint that weren't in the original story ACs, and any follow-on items it surfaced (bugs, "later" items, new spikes). This lives in **Product Documentations**, one doc per sprint.
2. **Close the sprint task** in its Sprints-folder list once the doc exists and is linked back from the sprint task (and the doc links back to the sprint task).
3. The underlying story tasks stay in their domain lists (Signals & Attention Triage, Enrollment & Cohort Management, etc.) at whatever status reflects reality (`shipped`/closed) — the sprint task closing doesn't change those, it's just the release-increment wrapper.

This keeps the Sprints folder as a live view of what's in-flight/next, while Product Documentations accumulates the actual record of what shipped and why — useful for onboarding, and for reconstructing "why did we build it that way" later.

**Current state (2026-07-11):** Sprints 1–4 are all open, nothing shipped yet, so nothing to convert yet. Applies going forward as each one closes out.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbyng](https://app.clickup.com/t/86capbyng)

---
