> **Source:** ClickUp — Sprints › SPRINT 3 — Learner Progress & Lessons ([link](https://app.clickup.com/t/86capbyez))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

# SPRINT 3 — Learner Progress & Lessons

**Release increment goal:** A learner enrolled from Sprint 2 can actually open the app, see where they are, consume a lesson of any in-scope type, take a multi-question assessment, and ask for help in-app — on a real or throttled connection.

**Ships & is testable as:** log in as a seeded learner → land on Progress Home → open current lesson (text/video/attachment/live/in-person all render correctly) → complete it → take an assessment → get pass/fail → tap the help button → submit a help request → confirm a `help_requested` Signal was emitted (verified via the Signals & Attention Triage domain, consumed properly in Sprint 4). Also: throttle the connection and confirm loading/retry/offline states behave.

**Includes (linked below):**
*   Progress overview / "where am I" home
*   Lesson content viewer (per type)
*   Module/lesson navigation (drip-aware)
*   Deep-link entry from WhatsApp nudge
*   In-app assessment flow (multi-question)
*   Low-bandwidth loading & offline states for lesson content
*   In-app "ask for help" structured capture

**Depends on:** Sprint 2's seeded Program/Module/Lesson content, and (for the deep-link story) at minimum a stubbed WhatsApp nudge URL — full Channel Service/WhatsApp Integration isn't sequenced yet (see note at end of this response).

## Linked stories

### [Progress & Assessments] Progress overview / "where am I" home

**Design:** [https://app.clickup.com/t/86cap5jz0](https://app.clickup.com/t/86cap5jz0) (`ProgressHome.jsx`)
**Technical direction:** Product principle "manage by exception" / "portal stays light" — this is the learner's primary, frequent entry point, not a dashboard/feed.

**User story:** As a learner, I want to open the app and immediately see where I am in the program and what's next, so checking in takes seconds, not navigation.

**Acceptance criteria:**
*   Shows: program name, current module, progress bar + percent complete, streak days, and a single primary action to jump into the current lesson.
*   No feed/dashboard-style content — this screen answers "where am I," nothing else.
*   Percent and streak are set in monospace per brand type rules (numerals = data, not prose).
*   Tapping the primary action opens the current lesson directly (ties into Lesson Content Viewer story).

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbvfn](https://app.clickup.com/t/86capbvfn)

---

### [Progress & Assessments] Lesson content viewer (per type)

**Design:** [https://app.clickup.com/t/86cap5jz7](https://app.clickup.com/t/86cap5jz7) (`LessonViewer.jsx`)
**Technical direction:** domain model §3 — Lesson *type* enum: `text | video | attachment | live_online | in_person` for v1 (`quiz` is a later lesson type — don't confuse with the separate Assessment entity, which IS in scope now). Video is **embed-only** for v1 (PO decision, see comment on the Program Builder "Lesson type editor" design task).

**User story:** As a learner, I want each lesson type rendered the way that makes sense for it (read a text lesson, watch an embedded video, download an attachment, see live/in-person details), so WhatsApp doesn't have to carry content it's not built for.

**Acceptance criteria:**
*   Text: readable body copy, no special chrome.
*   Video: embed player (no native upload/hosting — embed URL only), shows duration.
*   Attachment: file name + size, download action.
*   Live online / In-person: renders the relevant scheduling/location details (not full scheduling UI — that's Cohort/Enrollment's job).
*   `quiz` type is explicitly out of scope for this story (later per the ADR) — don't build a placeholder for it here.

**Status:** backlog · **Priority:** urgent · **ClickUp:** [86capbvg4](https://app.clickup.com/t/86capbvg4)

---

### [Progress & Assessments] Deep-link entry from WhatsApp nudge

**Design:** [https://app.clickup.com/t/86cap5jzd](https://app.clickup.com/t/86cap5jzd)
**Technical direction:** ADR-004/§5 (Channel Service → InboundEvent), ADR-009 (DripJob scheduling drives which lesson a nudge points to).

**User story:** As a learner tapping a WhatsApp reminder link, I want to land directly on the relevant lesson instead of the app's home screen, so the reminder actually saves me a step instead of costing me one.

**Acceptance criteria:**
*   Deep link from a WhatsApp nudge opens the app directly on the referenced lesson (bypassing Progress Home), with a brief transition state, not an abrupt jump.
*   A "back to home" affordance is still available from the deep-linked lesson (learner isn't stranded without normal navigation).
*   Link needs a stable lesson-addressable URL/route — flag to eng if the current routing approach (client-side state in the design demo) doesn't map cleanly to a real route; this is a case where real routes matter (per the design system's own caveat that the demo shell isn't a routing spec).

**Status:** backlog · **Priority:** high · **ClickUp:** [86capbvgg](https://app.clickup.com/t/86capbvgg)

---

### [Progress & Assessments] In-app assessment flow (multi-question)

**Design:** [https://app.clickup.com/t/86cap5jzx](https://app.clickup.com/t/86cap5jzx) (`AssessmentFlow.jsx`)
**Technical direction:** domain model §3 (Progress · Assessment entity, per Learner per Lesson) and ADR-010 (a failed assessment can drive a `quiz_failed` Signal). Note: this is the **Assessment entity**, not the `quiz` *Lesson type* — the latter is explicitly a later item; this story is in scope now.

**User story:** As a learner taking a multi-question check that doesn't fit a WhatsApp chat bubble, I want an in-app flow with clear pass/fail results, so I know exactly where I stand and my mentor gets an accurate signal if I'm struggling.

**Acceptance criteria:**
*   Sequential single-question-at-a-time flow, one answer picked per question, auto-advances.
*   Results screen shows clear pass/fail state.
*   A fail result is what feeds the `quiz_failed` Signal into Triage (backend wiring, not a UI concern here, but the UI must produce a clean pass/fail outcome for that to work off of).
*   Single-question checks stay on WhatsApp per the design note — this flow is only for multi-question assessments.

**Status:** backlog · **Priority:** high · **ClickUp:** [86capbvh3](https://app.clickup.com/t/86capbvh3)

---

### [Progress & Assessments] Module/lesson navigation (drip-aware)

**Design:** [https://app.clickup.com/t/86cap5k09](https://app.clickup.com/t/86cap5k09) (`ModuleLessonNav.jsx`)
**Technical direction:** ADR-009 (DripJob-driven pacing) — future lessons must stay visible-but-locked, not hidden, so pacing is legible without exposing scheduling internals.

**User story:** As a learner browsing my modules, I want to see the full lesson list with future/not-yet-available lessons clearly locked (not missing), so I understand the program's shape and pacing without confusion.

**Acceptance criteria:**
*   Each lesson row shows an icon matching its type (text/video/attachment/live_online/in_person; `quiz` icon reserved for later use).
*   Locked (future/undripped) lessons are visibly dimmed/disabled, not omitted from the list, and are not tappable.
*   Completed lessons show a distinct "done" state (filled indicator).
*   Locking state comes from the backend's drip schedule, not computed client-side from raw dates (avoids timezone/clock-skew bugs).

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbvhf](https://app.clickup.com/t/86capbvhf)

---

### [Progress & Assessments] Low-bandwidth loading & offline states for lesson content

**Design:** [https://app.clickup.com/t/86cap5k0f](https://app.clickup.com/t/86cap5k0f) (`LoadingStates.jsx` — `VideoLoading`, `RetryState`, and an `OfflineBanner` per the design system readme)
**Technical direction:** §7 of the ADR (bandwidth & connectivity constraints are core to the Africa-market brief, not an afterthought).

**User story:** As a learner on a slow or unreliable connection, I want lesson content (especially video/attachments) to show real loading/retry feedback instead of hanging or silently failing, so I trust the app on the network I actually have.

**Acceptance criteria:**
*   Video: progress-based loading state (percent, not an indefinite spinner) while buffering.
*   Failed load (attachment/video): explicit retry state with a retry action, not a dead screen.
*   Offline: a persistent banner while connectivity is down, distinct from a one-off error.
*   These states must be reachable/testable in a throttled-network dev environment before this is called done — not just visually built.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbvhz](https://app.clickup.com/t/86capbvhz)

---

### [Progress & Assessments] In-app "ask for help" structured capture

**Design:** [https://app.clickup.com/t/86cap8nje](https://app.clickup.com/t/86cap8nje) (`HelpCapture.jsx`)
**Technical direction:** ADR-003a — this is the canonical implementation of that ADR. Cross-cutting with **Signals & Attention Triage**: submitting this form is what emits the `help_requested` Signal into the mentor's queue (see the Exception Card / Ranking stories in that list) — flagging the dependency so the two workstreams land together, not as a reason to duplicate this story there.

**User story:** As a learner who wants help right now, I want a quick in-app form (not a chat) that tells my mentor I need help, optionally tied to the lesson I'm on, so I get a real "I asked" confirmation without leaving the app — while my mentor's actual reply still comes back on WhatsApp.

**Acceptance criteria:**
*   Floating help affordance (bottom-right, per design) opens a `Drawer`-based short form: free-text "what do you need help with," optionally scoped to current lesson context.
*   Submitting emits a `help_requested` Signal (backend) and shows a clear "sent" confirmation state in the drawer.
*   A `wa.me` deep-link is present alongside the form as a direct "or message us directly" fallback, at negligible extra cost per the design note.
*   This is explicitly **not** a chat surface — no message history, no reply-in-app. The mentor's reply arrives via WhatsApp, consistent with ADR-003.
*   A fast-follow (mirroring the mentor's WhatsApp reply back as a read-only card) is out of scope for this story — deferred per the ADR's own note.

**Status:** backlog · **Priority:** high · **ClickUp:** [86capbvjc](https://app.clickup.com/t/86capbvjc)

---

## Note on linked_tasks count

The sprint task's `linked_tasks` field returned **8** entries, not 7. The 8th entry (`86capbyng`, "Process: Sprint completion → release-increment doc") is a cross-cutting process/documentation task living in the **Product Documentations** folder — it describes the general process for closing out *any* sprint, not a Sprint-3-specific story, and its own record shows `linked_tasks_count: 4` (linked from multiple sprints, not just this one). It has been excluded from "Linked stories" above as it is not one of the 7 in-scope stories named in the sprint's own "Includes" list. All 7 genuine story links resolved successfully and all belong to the **Progress & Assessments** list under **Product Delivery & Engineering**.
