> **Source:** ClickUp — Product Documentations › BRD: WhatsApp Integration ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-275))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Purpose/Problem: Learners in this market live on WhatsApp, not in apps. If Fundi can't reliably deliver and receive messages there, it cannot meet people where they are.

Business Objective: Deliver compliant, reliable outbound messaging and parse inbound replies into structured events, within Meta policy, without the core domain touching WhatsApp specifics directly.

Target Users: Learners (recipients), creators (indirect — their voice is what's sent).

Scope In: BSP integration for v1 (ADR-004); MessageTemplate entity with versioned variable slots; 24-hour window logic (template-only outside, free text inside); basic inbound reply parsing (DONE / question / quiz answer).

Scope Out: Direct Cloud API migration (deferred); Telegram/SMS adapters (separate epic); rich inbound NLU.

Success Metrics: Message delivery success rate; template approval turnaround; opt-out rate; spam complaints.

Open blocking items: Every new proactive message kind needs Meta template approval — real lead time. BSP vendor not yet selected — needs short evaluation.

Dependencies: Scheduling & Drip Engine, AI Drafting, Channel Abstraction.
