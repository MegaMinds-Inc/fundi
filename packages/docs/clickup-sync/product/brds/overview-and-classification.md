> **Source:** ClickUp — Product Documentations › Overview & Classification ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-615/2kyr7tvt-175))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

Companion to: Fundi ADR v0.4, Product Brief · Status: Draft for review

## Classification: Business-facing vs. Enabling

| Epic | Type | Phase |
| ---| ---| --- |
| Program & Curriculum Builder | Business-facing | NOW |
| Enrollment & Cohort Management | Business-facing | NOW |
| Scheduling & Drip Engine | Business-facing | NOW |
| Signals & Attention Triage | Business-facing | NOW |
| WhatsApp Integration | Business-facing | NOW |
| AI Drafting & Triage Service | Business-facing | NOW |
| Creator PWA | Business-facing | NOW |
| Learner PWA | Business-facing | NOW |
| Progress & Assessments | Business-facing | NOW→NEXT (assessments split out) |
| Public Showcase & Distribution | Business-facing | NEXT |
| AI Scaffolding & Content Generation | Business-facing | NEXT/LATER |
| Team & Org Roles | Business-facing | LATER |
| Payments & Mobile Money | Business-facing | LATER |
| Analytics & Engagement | Business-facing | LATER |
| Channel Abstraction & Adapters | Enabling | NOW |
| Identity & Auth | Enabling | NOW |
| Multi-tenancy & Org Management | Enabling | NOW |
| Notifications & Media/Storage | Enabling | NOW |
| Design System | Enabling | NOW |
| Platform Infrastructure & DevOps | Enabling | NOW |

This batch covers full BRDs for the 8 NOW-phase business-facing epics (sub-pages below), plus technical scope notes for the 6 NOW-phase enabling epics.

## Enabling epics — technical scope notes

| Epic | One-line scope | Serves |
| ---| ---| --- |
| Channel Abstraction & Adapters | Core-to-channel interface so WhatsApp/Telegram/SMS are adapters, not rewrites | WhatsApp Integration |
| Identity & Auth | Phone-first OTP + refresh/access token issuance | All epics requiring login |
| Multi-tenancy & Org Management | `organisation_id` enforcement at query/repo layer | Every tenant-scoped table |
| Notifications & Media/Storage | S3-compatible storage, adaptive media delivery | Program Builder (attachments), WhatsApp (media sends) |
| Design System | Shared `packages/ui` tokens/components across both PWAs | Creator PWA, Learner PWA |
| Platform Infrastructure & DevOps | AWS hosting, CI/CD, observability | Everything |

## Open items requiring a decision before or during Phase 0/1 build
1. Embed-only vs. hosted video (Program & Curriculum Builder) — needs confirmation
2. BSP vendor selection (WhatsApp Integration) — needs short evaluation
3. Specific triage rule set (Signals & Attention Triage) — needs a dedicated design pass with product, separate from this BRD
4. AI cost ceiling per creator/month (AI Drafting) — needs a decision before scaling past pilot creators
