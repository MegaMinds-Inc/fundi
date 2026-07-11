> **Source:** ClickUp — Product Documentations › BRD: Creator PWA ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-315))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Purpose/Problem: Every core-domain epic needs a surface creators actually use daily — builder, dashboard, triage queue. Without a coherent app these are just backend capabilities no one can reach.

Business Objective: Give creators a single, installable, low-friction web app covering the full daily workflow — build, monitor, respond to exceptions — usable on a mid-range Android device without an app-store install.

Target Users: Creators / mentors / trainers.

Scope In: Program builder UI, enrollment/cohort management UI, Needs You triage queue UI, AI draft review/approval UI, installable PWA.

Scope Out: Native app (deferred, ADR-012); in-app real-time chat (ruled out, ADR-003).

Success Metrics: PWA install rate among active creators; daily/weekly active creator rate; creator retention at 30/60/90 days.

Assumptions: Separately bundled from Learner PWA — no builder code ships to a learner device. Shares design-system package via monorepo.

Dependencies: Design System, and every core-domain epic as its surface.
