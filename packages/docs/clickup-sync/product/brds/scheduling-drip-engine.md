> **Source:** ClickUp — Product Documentations › BRD: Scheduling & Drip Engine ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-235))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Purpose/Problem: This is the mechanical heart of create-and-forget. Without reliable, timezone-aware, retryable delivery of lessons and reminders, the product promise collapses.

Business Objective: Guarantee scheduled content and reminders reach the right learner at the right local time, every time, without human triggering, with failures visible and recoverable.

Target Users: Indirect for creators and learners — no UI of its own; the reliability layer other epics depend on.

Scope In: DripJob queue (BullMQ/Redis) for lesson sends, reminders, triage escalation; idempotent jobs; exponential-backoff retries; per-learner/cohort timezone awareness.

Scope Out: Human-configurable drip rule editor beyond basic per-lesson timing.

Success Metrics: Job success rate; retry-to-success rate; near-zero learner-reported missed/late messages.

Assumptions: No cron-on-a-box for learner-facing sends (ADR-009). A missed send is a broken product promise, not a minor bug.

Dependencies: Enrollment & Cohort Management, WhatsApp Integration, Channel Abstraction.
