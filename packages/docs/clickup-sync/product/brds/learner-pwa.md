> **Source:** ClickUp — Product Documentations › BRD: Learner PWA ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-335))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Purpose/Problem: Learners need a light way to see their own progress and lessons without WhatsApp being their only touchpoint — but this surface must stay genuinely thin, since most engagement happens on WhatsApp.

Business Objective: Give learners a minimal, fast-loading, installable surface for viewing lesson content and progress, plus a way to signal they need help without becoming a chat product.

Target Users: Learners.

Scope In: Lesson viewing and progress display; in-app ask-for-help structured capture emitting a help\_requested Signal (ADR-003a, not a chat thread); installable PWA.

Scope Out: Any real-time chat surface (ruled out, ADR-003); mirroring mentor's WhatsApp reply back into the app (fast-follow, not this version).

Success Metrics: PWA install rate among enrolled learners; help-request rate vs went\_quiet signal rate; bundle size/load time on constrained devices.

Assumptions: Must perform acceptably on low-end Android and unreliable connections. A [wa.me](http://wa.me) deep-link fallback alongside the structured form is worth keeping at negligible cost.

Dependencies: Design System, Progress & Assessments, Signals & Attention Triage.
