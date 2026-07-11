> **Source:** ClickUp — Product Documentations › BRD: Signals & Attention Triage ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-255))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Purpose/Problem: A creator running 200 learners cannot manually check on everyone. Without a way to surface who needs attention, manage-by-exception doesn't exist, and creators either burn out or miss struggling learners.

Business Objective: Surface the small number of learners who genuinely need a human, explainably, so a creator trusts the queue enough to act on it.

Target Users: Creators / mentors.

Scope In: Append-only Signal stream (lesson\_overdue, reminder\_unacknowledged, quiz\_failed, help\_requested, went\_quiet); rules-based scoring producing the Needs You queue; visible reason per surfaced learner.

Scope Out: Model-assisted ranking (upgrade path only, ADR-010); creator-configurable rule thresholds.

Success Metrics: % of queue items actioned within 48h; creator-reported trust in the queue; learner drop-off rate among surfaced vs non-surfaced learners.

Open blocking item: The actual rule set (thresholds, signal combinations, staleness weighting) needs a dedicated design pass with product — not resolved by this BRD.

Dependencies: Enrollment, Scheduling & Drip, WhatsApp Integration, AI Drafting.

* * *

## Design-pass note — Snooze behavior (Needs You UI kit) — RESOLVED (design assumption, pending PO confirmation)

Original gap: this BRD didn't cover what "Snooze" actually does. Since it was blocking review, we made a design-level assumption rather than leaving it open indefinitely — implemented in the UI kit now, **flagged here for PO confirmation, not a final product decision.**

**Implemented pattern:**
*   Quick Snooze (from the card/table row, one tap) applies a **default 3-day snooze** — optimistic, no confirmation dialog, with a "Snoozed \[name\] for 3 days · Undo" toast (4s window, fully reversible).
*   Snooze from the take-action drawer opens a **short duration picker** (1 day / 3 days / 1 week, 3 days shown as the default) — for the cases where a coach knows this can wait a specific amount of time, not just "not today."
*   The learner resurfaces automatically when **either** (a) the snooze period elapses, **or** (b) a _new_ Signal fires for them before then — whichever comes first. Snoozing should never fully silence a learner whose situation is actively getting worse.

**Still open for product/PO — did not guess at these:**
1. Does a snoozed learner still count against any "on track" cohort stats while hidden from the queue?
2. Does re-triggering during snooze (case b above) need its own Signal-stream semantics, or does the existing Signal just naturally supersede the snooze client-side?

Recommend folding these two into the same rule-set design pass already flagged as this BRD's open blocking item. If the PO wants a different default duration or a fixed-only (no picker) behavior, that's a one-line change in the UI kit, not a rebuild — flag it and we'll adjust.
