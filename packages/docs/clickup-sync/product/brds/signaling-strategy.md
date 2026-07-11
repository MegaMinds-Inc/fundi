> **Source:** ClickUp — Product Documentations › Signaling Strategy — Current State (For Review) ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-555))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Status: **Draft for review** · Compiled from ADR v0.5, Product Brief, BRD: Signals & Attention Triage

This page consolidates the signaling strategy as currently defined across all Fundi product and architecture docs into a single reviewable reference.

* * *

## 1\. Purpose & guiding principle
Fundi's core product principle is **manage by exception**: automation carries the on-track majority; only learners who genuinely need a human are surfaced to the creator. The Signal system is how we know who those learners are.

A creator running 200 learners cannot manually check on everyone. Without Signals, "manage by exception" doesn't exist.

* * *

## 2\. What a Signal is
A **Signal** is an append-only event recorded against a specific learner within a specific enrollment/program context. Signals are never edited or deleted — they form an immutable audit trail of attention-worthy moments.

Each Signal carries:
*   **Type** (one of the defined taxonomy below)
*   **Learner** reference
*   **Program / Lesson** context (what triggered it)
*   **Timestamp**
*   **Metadata** (e.g. how many days overdue, which reminder was unacknowledged)

* * *

## 3\. Signal taxonomy (v1)
Five signal types ship in v1. This is the locked taxonomy — new types can be added later without architectural change.

| Signal type | Fires when | Source |
| ---| ---| --- |
| `lesson_overdue` | A learner has not completed a lesson by its scheduled due date | Scheduling & Drip engine (DripJob) |
| `reminder_unacknowledged` | A WhatsApp reminder was sent and the learner did not respond within the expected window | Channel Service (inbound timeout) |
| `quiz_failed` | A learner fails an assessment below the passing threshold | Assessments module (later, but Signal contract exists now) |
| `help_requested` | A learner explicitly asks for help — either via in-app help bubble (ADR-003a) or by sending a help keyword on WhatsApp | Learner app (structured capture) or Channel Service (keyword parsing) |
| `went_quiet` | A learner has had no activity (lesson completion, replies, app opens) for a defined period | Background job / activity monitor |

* * *

## 4\. How Signals are generated
**From the Drip Engine:** When a DripJob fires (lesson reminder, check-in) and the expected learner action doesn't happen within a window, the scheduling module emits the appropriate Signal.

**From inbound messages:** Reply → Channel Service → InboundEvent → Core parses the event. If it's a help keyword or a non-response timeout, a Signal is emitted.

**From the learner app:** The in-app help bubble submits a structured form (scoped to current lesson) which directly emits a `help_requested` Signal into the stream (ADR-003a). No new infrastructure needed — it rides on the existing Signal → Triage pipeline.

**From activity monitoring:** A background process monitors per-learner activity. If a learner goes silent (no completions, no replies, no app opens) beyond a threshold, `went_quiet` fires.

```plain
DripJob timeout       → lesson_overdue / reminder_unacknowledged
Channel inbound parse → help_requested (keyword)
Learner app form      → help_requested (structured)
Activity monitor      → went_quiet
Assessment result     → quiz_failed
```

* * *

## 5\. From Signals to Triage (the "Needs You" queue)
Signals don't surface to the creator directly. They feed into a **rules-based scoring engine** that produces the ranked "Needs You" queue.

**v1 approach (LOCKED):** Rules-based scoring. A set of rules evaluates the Signal stream per learner and produces a priority score. The same input contract supports model-assisted ranking later without a rewrite (ADR-010).

**What the creator sees:** A ranked queue of learners who need attention, each with a **visible reason** (the Signal or combination that surfaced them). Trust requires explainability — the coach must understand _why_ someone appeared.

**Upgrade path:** v1 is rules-first. The architecture explicitly preserves the option to layer model-assisted ranking on top of the same Signal stream contract. The scoring module is swappable; the Signal taxonomy and Triage queue interface stay stable.

* * *

## 6\. Triage actions (creator response)
Once a learner is surfaced in the queue, the creator can:
*   **Act** — Deep-link to the WhatsApp thread (Fundi never hosts the conversation per ADR-003), approve an AI-drafted message, or mark resolved
*   **Snooze** — Quick snooze (3-day default, one tap, toast with undo) or duration picker (1 day / 3 days / 1 week)
*   **Dismiss / resolve** — Remove from queue with a reason

**Snooze behavior (design assumption, pending PO confirmation):**
*   Learner resurfaces when _either_ (a) snooze period elapses, _or_ (b) a new Signal fires before then — whichever comes first
*   Snoozing never fully silences a learner whose situation is actively worsening

* * *

## 7\. AI's role in the Signal flow
AI is downstream of Signals, not upstream. It does not _generate_ Signals — it helps the creator _respond_ to them:
*   **Message drafting:** When a creator acts on a triage item, AI drafts a nudge/check-in in the coach's voice. Always human-approved before send.
*   **Triage ranking (later):** Model-assisted scoring of the Signal stream — suggesting _which_ learner needs attention most urgently and recommending a next action.

AI never contacts a learner without explicit human approval. This is a guardrail, not a toggle.

* * *

## 8\. Open items (unresolved)
These are flagged across the ADR and BRD and do **not** block Release 0 start, but must be resolved before Release 6 (Signals, Triage & AI Drafting):
*   **Rule set definition:** Specific thresholds, signal combinations, and staleness weighting — needs a dedicated design pass with product
*   **`went_quiet`** **threshold:** How many days of silence before firing? Likely program-shape-dependent (self-paced vs. cohort)
*   **`reminder_unacknowledged`** **window:** How long after a reminder before we escalate to Signal? (hours? 24h? configurable per program?)
*   **Snooze + cohort stats:** Does a snoozed learner still count against "on track" metrics while hidden from queue?
*   **Re-trigger semantics:** If a new Signal fires during snooze (case b), does the existing Signal supersede the snooze client-side, or does the stream need its own snooze-break event?
*   **Signal deduplication:** If a learner is overdue on 3 lessons, is that 3 Signals or 1? (Likely 3 events in stream, but scored/displayed as one queue entry with a count)

* * *

## 9\. Technical contract (summary)

```typescript
// Signal entity shape (conceptual)
interface Signal {
  id: string;
  type: 'lesson_overdue' | 'reminder_unacknowledged' | 'quiz_failed' | 'help_requested' | 'went_quiet';
  learnerId: string;
  enrollmentId: string;
  programId: string;
  organisationId: string; // org-scoped, always
  lessonId?: string;       // context, when applicable
  metadata: Record<string, unknown>; // type-specific details
  createdAt: Date;         // immutable
}
```

Signals are **append-only** (no UPDATE, no DELETE). Triage state (resolved, snoozed) lives on a separate TriageItem entity that references Signals, not on the Signal itself.

* * *

## 10\. References
*   ADR-010: Attention triage (rules-based scoring, model-assisted later)
*   ADR-003a: In-app help as structured Signal capture
*   BRD: Signals & Attention Triage
*   BRD: Scheduling & Drip Engine (DripJob → Signal emission)
*   Product Brief §08: Engagement & messaging strategy
*   Product Brief §04: "Manage by exception" principle
