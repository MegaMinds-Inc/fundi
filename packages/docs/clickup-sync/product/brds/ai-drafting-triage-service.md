> **Source:** ClickUp — Product Documentations › BRD: AI Drafting & Triage Service ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-295))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Purpose/Problem: Creators don't have time to write every reminder, check-in, and nudge by hand at scale, but a fully automated voice that isn't theirs erodes learner trust.

Business Objective: Let AI draft on-brand, in-voice messages and next-action suggestions that a creator (or rule) approves before anything reaches a learner — reducing creator time-per-learner without reducing quality or trust.

Target Users: Creators (approve/edit drafts), indirectly learners (receive output).

Scope In: Drafting reminders/check-ins/broadcasts in the coach's voice; fills MessageTemplate variables outside 24h window, free text inside it; mandatory human approval before send; output logging for audit.

Scope Out: AI Scaffolding (separate epic); fully autonomous send with no human approval (explicitly out for v1, ADR-011).

Success Metrics: Draft-to-send approval rate unedited; average edit distance; creator time per learner per week (should decrease); engagement rate AI-assisted vs manual (should be neutral or better).

Assumptions: No learner PII in prompts beyond what's needed. Cost ceiling per creator/month is an open question needing a decision before scaling past pilot creators.

Dependencies: WhatsApp Integration, Signals & Attention Triage.
