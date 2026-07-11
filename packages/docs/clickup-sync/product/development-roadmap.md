> **Source:** ClickUp — Product Documentations › Fundi Development Roadmap ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-595/2kyr7tvt-155))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

> **Status:** Approved direction — pending final sign-off before ClickUp task creation.  
>   
> **Companion docs:** Product Brief · Technical Direction (Summary) · FUNDI\_ADR (this project) · Design System Foundations.  
>   
> **Environment stack:** Local (Docker Compose) → **Dev** (Render + Supabase + Upstash, free tier) → Staging (AWS) → Production (AWS). See §Environments below.

# Fundi Development Roadmap

Release-based roadmap: each release is a shippable increment. Releases 0–8, cumulatively, constitute the **MVP** as defined in the Product Brief (§13). Post-MVP work continues under the same release model, split into "Next" and "Later" phases matching the Brief's own phasing (§14) and the ADR's technical phasing (§10).

## Environments

| Environment | Stack | Used for |
| ---| ---| --- |
| Local | Docker Compose — Postgres + Redis on each engineer's machine | Day-to-day development, from Release 0 |
| Dev | Render (app hosting, git-push deploys) + Supabase (managed Postgres, free tier) + Upstash (managed Redis, free tier) | Shared team environment — PR previews, integration testing, WhatsApp BSP sandbox integration. Layer on top of local, not a replacement for it. |
| Staging | AWS (RDS, ElastiCache, S3, ECS Fargate/App Runner) via IaC, mirrors intended prod topology | Pre-launch validation — real BSP number, load/soak testing, before Release 8 |
| Production | AWS (same IaC as staging, different variables); `af-south-1` (Cape Town) flagged as fallback region if data-residency requirements harden (ADR-007) | Live product, from MVP go-live onward |

**Note:** Dev PaaS choice is a near-term cost/speed decision, not a locked architectural one — the AWS-based staging/production path (ADR-007) is unaffected by it. IaC (Terraform/CDK) is written once for staging/prod so there's no re-architecture at that stage, only the Dev environment sits outside that IaC.

* * *

## Release 0 — Engineering Foundations
**Environment:** Local + Dev
Nothing product-facing ships; this is the platform every later release builds on.

*   Repo scaffold: NestJS modular monolith, Turborepo (`apps/creator`, `apps/learner`, `packages/ui`)
*   Docker Compose for local Postgres + Redis
*   Dev environment stood up on Render + Supabase + Upstash, connected to CI
*   CI/CD: lint/test/build → auto-deploy to Dev on merge
*   Prisma schema baseline + migration pipeline
*   dependency-cruiser rules enforcing module boundaries (ADR-002) from commit one
*   Basic logging/error tracking wired in

**Exit criteria:** an engineer clones the repo, runs it locally, pushes a change, sees it live on Dev.

## Release 1 — Identity & Org Skeleton
**Environment:** Dev

*   Phone-number-first OTP auth · refresh/access tokens + silent refresh
*   Org sign-up (creator = org) · `organisation_id` scoping enforced at repository layer (ADR-008)

**Exit criteria:** a creator can sign up, verify by OTP, and land in an empty org.

## Release 2 — Program Builder Core
**Environment:** Dev

*   Program/Module/Lesson domain + CRUD
*   Lesson types: text, video (embed), attachments, live/online, in-person
*   Creator PWA: builder UI (from design-system components)

**Exit criteria:** a creator can build a real multi-module program end to end in the app.

## Release 3 — Enrollment & Learner Portal Basics
**Environment:** Dev

*   Invite/enroll flow, Cohort & Enrollment states (`pending_approval` → `active` → `completed`/`dropped`)
*   Learner PWA: basic progress view

**Exit criteria:** a creator invites a learner, the learner sees their program and progress.

## Release 4 — Messaging Foundation
**Environment:** Dev, WhatsApp BSP sandbox

*   Channel Service abstraction (interface only, WhatsApp adapter first)
*   BSP vendor selection + sandbox integration
*   `MessageTemplate` entity + Meta template submission workflow

**Exit criteria:** the app can send one hardcoded template message through the sandbox number.

## Release 5 — Scheduling & Automated Reminders
**Environment:** Dev

*   BullMQ + Redis drip engine, `DripJob` model (idempotent, retryable, timezone-aware)
*   Wired to Release 4: lesson-due reminders actually send

**Exit criteria:** enrolling a learner triggers real, scheduled WhatsApp reminders in the sandbox.

## Release 6 — Signals, Triage & AI Drafting
**Environment:** Dev

*   `Signal` stream (`lesson_overdue`, `reminder_unacknowledged`, `quiz_failed`, `help_requested`, `went_quiet`)
*   Rules-based scoring → "Needs you" queue in the creator dashboard
*   AI service module seam (guardrails, cost caps, logging) + message drafting, human-approved before send

**Exit criteria:** a coach sees a ranked exception queue and can approve an AI-drafted nudge.

## Release 7 — Visibility, Approval Gating & In-App Help
**Environment:** Dev

*   Public/private (approval-gated) program visibility
*   Structured in-app "ask for help" capture → `help_requested` Signal (ADR-003a)

**Exit criteria:** the full product-principle set from the Brief (§13, "IN v1") is functionally present.

## Release 8 — Staging & Production Readiness _(infra, not new product features)_
**Environment:** Staging → Production (AWS)

*   Provision AWS staging (RDS, ElastiCache, S3, ECS Fargate/App Runner) via IaC — same definitions as later production, different variables
*   Full BSP path tested with a real (non-sandbox) number end-to-end
*   Load/soak test the drip engine at realistic volume
*   Production AWS provisioning, secrets/access controls, backup/restore drill
*   WhatsApp production number + real template approvals live

**Exit criteria:** the Release 0–7 product is running on production infrastructure, tested, with a real WhatsApp number.

* * *

## 🚀 MVP Go-Live

Releases 0 through 8, cumulatively, **are** the MVP as defined in the Product Brief (§13). Nothing past this point blocks launch.

* * *

## Post-MVP — "Next" Releases

Same release cadence continues; matches Product Brief §14 "NEXT" and ADR §10 "NEXT."

*   **R9** — Inbound reply parsing (DONE/question/quiz-answer → Signal)
*   **R10** — Assessments (quiz lesson type + AI quiz generation)
*   **R11** — Cohort broadcasts & WhatsApp groups
*   **R12** — AI program scaffolding
*   **R13** — Public showcase pages
*   **R14** — Model-assisted triage upgrade (same Signal contract, better ranking)

## Post-MVP — "Later" Releases

Matches Product Brief §14 "LATER" and ADR §10 "LATER."

*   **R15** — Mobile-money payments via aggregator
*   **R16** — Telegram/SMS channel adapters
*   **R17** — Co-mentor roles & team management
*   **R18** — Publish-once social distribution
*   **R19** — Analytics & streaks
*   **R20** — Infra scale review: direct WhatsApp Cloud API migration off BSP, `af-south-1` migration if residency requires it, module extraction (Messaging/AI) if scale demands it

* * *

## Open decisions to resolve (don't block Release 0 start)

*   LLM provider selection + per-creator cost ceiling
*   Media hosting depth (embed-only vs. hosted video)
*   Specific triage rule thresholds (mechanism is locked; rules aren't)
*   BSP vendor choice (360dialog vs. Twilio vs. MessageBird) — needed by Release 4
*   Confirm Dev PaaS specifics: Render (web) + Supabase (Postgres) + Upstash (Redis) as the default combination — revisit if an all-in-one platform (e.g. Railway) is preferred instead
