# ClickUp sync

An offline mirror of the ClickUp Sprint and Product documentation for Fundi, so implementation
(by humans or agents) doesn't require live ClickUp access.

**This is a point-in-time snapshot, not a live sync.** Every file carries a `Synced:` date and a
`Source:` link back to the canonical ClickUp page/task. If ClickUp content changes, this mirror
goes stale until someone re-runs the sync — there's no automated re-sync script (it needs the
ClickUp MCP tools, which only exist inside an agent session, not a standalone Node script). To
re-sync: ask an agent to re-fetch the relevant ClickUp doc/task IDs (linked in each file's header)
and overwrite the file.

## `product/` — Product Documentations (ClickUp folder)

| File | Covers |
|---|---|
| [`product-brief.md`](./product/product-brief.md) | Product Brief v0.2 — what Fundi is, who it's for, MVP cut line |
| [`technical-architecture-adr.md`](./product/technical-architecture-adr.md) | Technical Architecture ADR v0.5 — full ADR-001 through ADR-013 |
| [`development-roadmap.md`](./product/development-roadmap.md) | Fundi Development Roadmap |
| [`design-system-foundations.md`](./product/design-system-foundations.md) | Design System Foundations |
| [`brds/overview-and-classification.md`](./product/brds/overview-and-classification.md) | BRD doc — overview & classification of Phase 0/1 epics |
| [`brds/program-curriculum-builder.md`](./product/brds/program-curriculum-builder.md) | BRD: Program & Curriculum Builder |
| [`brds/enrollment-cohort-management.md`](./product/brds/enrollment-cohort-management.md) | BRD: Enrollment & Cohort Management |
| [`brds/scheduling-drip-engine.md`](./product/brds/scheduling-drip-engine.md) | BRD: Scheduling & Drip Engine |
| [`brds/signals-attention-triage.md`](./product/brds/signals-attention-triage.md) | BRD: Signals & Attention Triage |
| [`brds/whatsapp-integration.md`](./product/brds/whatsapp-integration.md) | BRD: WhatsApp Integration |
| [`brds/ai-drafting-triage-service.md`](./product/brds/ai-drafting-triage-service.md) | BRD: AI Drafting & Triage Service |
| [`brds/creator-pwa.md`](./product/brds/creator-pwa.md) | BRD: Creator PWA |
| [`brds/learner-pwa.md`](./product/brds/learner-pwa.md) | BRD: Learner PWA |
| [`brds/signaling-strategy.md`](./product/brds/signaling-strategy.md) | Signaling Strategy — Current State (For Review) |

## `sprints/` — Sprints 0-4

| File | Covers | Status |
|---|---|---|
| [`sprint-0-repo-scaffolding.md`](./sprints/sprint-0-repo-scaffolding.md) | Repo scaffolding (monorepo, shared config, NestJS skeleton, boundary enforcement, PWAs, docs) | Tasks 1-4, 7 done; 5, 6, 8 remain |
| [`sprint-1-identity-org-design-system.md`](./sprints/sprint-1-identity-org-design-system.md) | Identity/OTP auth, org creation, design system tokens+components | Not started |
| [`sprint-2-program-access-enrollment.md`](./sprints/sprint-2-program-access-enrollment.md) | Seeded programs, invite/approve learners, cohort roster | Not started |
| [`sprint-3-learner-progress-lessons.md`](./sprints/sprint-3-learner-progress-lessons.md) | Learner progress home, lesson viewer, assessments, help request | Not started |
| [`sprint-4-needs-you-attention-triage.md`](./sprints/sprint-4-needs-you-attention-triage.md) | Mentor "Needs You" queue for `help_requested` signals | Not started |

**Note on Sprint 1-4 structure:** unlike Sprint 0 (which has real subtasks), Sprints 1-4 in
ClickUp are single "release increment goal" tasks with `linked_tasks` pointing to the actual
user-story-level tasks, scattered across ~20 domain-specific ClickUp lists (Design System,
Identity & Auth, Enrollment & Cohort Management, etc.). Each synced sprint file resolves and
inlines every linked story's full description/acceptance criteria — a sprint file with just the
goal summary wouldn't be enough to implement anything from.

**Note on "Sprint 4":** it lives inside the **Sprint 1** ClickUp list, not its own list — a
workspace list-limit was hit when Sprint 2 and 3 got their own lists, so Sprint 4 was created as
a task alongside Sprint 1's instead. Functionally a distinct release increment either way.
