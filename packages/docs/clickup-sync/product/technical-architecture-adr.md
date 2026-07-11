> **Source:** ClickUp — Product Documentations › Fundi — Technical Architecture (ADR) v0.5 ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-715/2kyr7tvt-435))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

# Fundi — Technical Architecture

> Working name: **Fundi** · Project: Creator Curriculum Platform  
> Status: **v0.5** — decisions resolved, ready for build kickoff · Companion to `Product Brief`  
> Audience: Engineering. This is the binding technical direction. Items marked **LOCKED** are decided; everything else is the current best recommendation and can be revisited via a new ADR.

* * *

## 0\. What Fundi is (context)

Fundi is an **AI-powered, "create-and-forget" platform** that lets creators, educators, mentors and trainers build a course/program once, invite learners, and let the system run delivery — reminders, content drip, check-ins, assessments — mostly over **WhatsApp**. Africa-first market. Creators focus on their craft; AI and automation handle drafting, tracking, nudging and admin.

**Product principles that drive architecture:**
1. **Create & forget** — creator effort goes into content; everything downstream runs itself.
2. **Manage by exception** — automation carries the on-track majority; surface only learners who need a human.
3. **Meet people on WhatsApp** — conversation lives where learners already are; Fundi orchestrates, the channel carries it.
4. **AI does the busywork** — drafting, triage, content shaping.

* * *

## 1\. Technical principles

*   **Channel-agnostic core** — product logic never talks to WhatsApp directly. It emits _intents_ to a channel layer. Telegram/SMS become adapters, not rewrites.
*   **AI as a service, human in the loop** — AI is an isolated capability behind a clean interface. It drafts and suggests; a person or a rule approves before anything reaches a learner.
*   **Built for low bandwidth** — lean payloads, offline-tolerant clients, WhatsApp doing heavy lifting. Learners never need a fast connection or a big app.
*   **Simple first, scalable later** — one well-structured codebase (modular monolith) over premature microservices. Clear module boundaries so services can be extracted only when scale demands.
*   **Every table is org-scoped from day one** — multi-tenancy is not a "later" concern; it's a schema-level default applied at row creation, regardless of how isolation is enforced later.

* * *

## 2\. System at a glance

```
┌─ CLIENTS ─────────────────────────────────────────────────────────┐
│  Creator web app · Learner portal (web/PWA) · Public showcase pages │
├─ API GATEWAY ─────────────────────────────────────────────────────┤
│  Auth · REST · rate limiting · inbound webhooks                     │
├─ CORE DOMAIN (NestJS modules, org-scoped) ────────────────────────┤
│  Programs · Enrollment · Scheduling & Drip · Progress ·             │
│  Signals · Triage · Assessments                                     │
├─ CAPABILITY SERVICES ─────────────────────────────────────────────┤
│  Channel service (WhatsApp+) · AI service · Payments (later) ·      │
│  Media/storage · Notifications                                      │
├─ EXTERNAL ────────────────────────────────────────────────────────┤
│  WhatsApp Business Cloud API (via BSP or direct) · LLM provider ·   │
│  Mobile money (later) · S3-compatible object storage · Email/SMS   │
└───────────────────────────────────────────────────────────────────┘
```

* * *

## 3\. Core domain model

| Entity | Key relationships |
| ---| --- |
| Organisation | has many Mentors, Programs, billing. Every creator starts as an org. `organisation_id` is a required column on every tenant-scoped table. |
| Mentor | belongs to Org; owns/runs Programs; has a role. |
| Program | has a shape + visibility; has many Modules; has Cohorts. |
| Module → Lesson | ordered; Lesson has a type (text / video / attachment / live / in-person / quiz later). |
| Cohort · Enrollment | links Learner ↔ Program on a schedule; has approval state. |
| Learner | phone-first identity; has Progress; reachable via Channel. |
| Progress · Assessment | per Learner per Lesson; drives Signals & completion. |
| Signal | append-only event (overdue, no-reply, quiz-failed, help-keyword, went-quiet). Feeds Triage. |
| Message · MessageTemplate · Channel | outbound intents + inbound events; channel-agnostic; templates are the WhatsApp-compliant shape AI drafts variables into. |
| DripJob | scheduled unit of work (send lesson N, send reminder, escalate to triage) — queued, retryable. |

**Enumerations**
*   Program _shape_: `self_paced` · `cohort` · `one_to_one` · `workshop` · `hybrid`
*   Program _visibility_: `public` · `private` (approval-gated)
*   Lesson _type_: `text` · `video` · `attachment` · `live_online` · `in_person` · `quiz` (later)
*   Enrollment _state_: `pending_approval` · `active` · `completed` · `dropped`
*   Signal _type_: `lesson_overdue` · `reminder_unacknowledged` · `quiz_failed` · `help_requested` · `went_quiet`

* * *

## 4\. Key technical decisions

### 4.1 Learner identity — phone-number-first — **LOCKED**
Phone number is the identity anchor (WhatsApp address, mobile-money handle, universal in-market). OTP to phone for auth. Long-lived refresh tokens + short-lived access tokens with silent refresh — OTP becomes rare, not every login. See **ADR-001**.

### 4.2 Architecture shape — modular monolith — **LOCKED**
One deployable app (NestJS), strict module boundaries (Programs, Messaging, AI, Payments, Scheduling). See **ADR-002**.

### 4.3 In-app chat vs. channel-only — **LOCKED: channel-only**
No in-app real-time chat inbox. Contradicts "create & forget," adds a second engagement surface to maintain, and duplicates what WhatsApp already does well. Revisit only if a specific premium 1:1 program type demands a native thread. See **ADR-003**.

### 4.4 Messaging — WhatsApp Business Cloud API + channel abstraction — **RECOMMENDED, BSP for v1**
See **ADR-004** for full tradeoff. Wrapped behind an internal channel interface either way — the core never knows it's WhatsApp.

### 4.5 Message templating regime — **LOCKED (new)**
Outbound messages outside the 24-hour customer-service window must use Meta-approved templates with variable slots — free-form AI text cannot be sent directly outside that window. See **ADR-005**.

### 4.6 Tech stack — **LOCKED (new)**
Node.js/TypeScript end-to-end: NestJS (API), React + Next.js (creator app, learner PWA, public showcase pages), PostgreSQL, Redis + BullMQ. See **ADR-006**.

### 4.7 Hosting & infrastructure — **RECOMMENDED (new)**
AWS, region-flexible, with `af-south-1` (Cape Town) as the fallback region if data-residency requirements harden. See **ADR-007**.

### 4.8 Multi-tenancy — **LOCKED (new)**
Shared database, `organisation_id` on every tenant table, enforced at the query/ORM layer. See **ADR-008**.

### 4.9 Scheduling & drip — **LOCKED (new)**
Durable job queue (BullMQ/Redis), not cron. See **ADR-009**.

### 4.10 Attention triage — **RECOMMENDED (new)**
Signal stream (append-only events) + rules-based scoring in v1; same input contract supports model-assisted ranking later without a rewrite. See **ADR-010**.

### 4.11 AI — hosted LLM behind a prompt/policy layer — **RECOMMENDED**
One internal AI service owning prompts, guardrails, cost controls, provider-swap seam. All outputs auditable; human approval before any external send. See **ADR-011**.

### 4.12 Payments — mobile money via aggregator — **PROPOSED, deferred**
Until payments land, private + approval-gated programs carry paid access. No change from original direction.

### 4.13 Monorepo tooling — pnpm workspaces + Turborepo — **LOCKED (new)**
pnpm for package management (strict, non-flat dependency resolution — extends ADR-002's module-boundary discipline to the workspace level), Turborepo for task orchestration and caching across `apps/*` and `packages/*`. See **ADR-013**.

* * *

## 5\. Channel & messaging architecture

```
Core → MessageIntent → Channel Service → [ WhatsApp adapter | Telegram* | SMS* ]
Reply → Channel Service → InboundEvent (DONE / question / quiz answer) → Core → Signal → Triage
```

*   `*` Telegram/SMS are **future adapters**. Adding one touches only the channel service — never the core.
*   **Cohort groups** are a channel target too: composed content is pushed to the group.
*   Keep **engagement channels** (WhatsApp/Telegram/SMS — private delivery) distinct from **marketing channels** (social — public, top-of-funnel).
*   **MessageTemplate** is a first-class entity: approved shape + named variable slots, versioned, one row per Meta-approved template. AI drafting fills variables within the approved template when outside the 24h window; drafts free text when inside it (e.g., replying to an active conversation).

* * *

## 6\. AI architecture

| Capability | Notes |
| ---| --- |
| Message drafting | Reminders, check-ins, broadcasts in the coach's voice. Always human-approved before send. Drafts template variables outside the 24h window, free text inside it. (v1) |
| Attention triage | Ranks who needs a human from the Signal stream; suggests next action. Rules-first, model-assisted. (v1) |
| Scaffolding & quizzes | Draft program structure and assessment questions from a topic or lesson content. (later) |

**Guardrails:** no learner PII in prompts beyond what's needed; log AI outputs; human approval before any external send.

* * *

## 7\. Africa-market constraints

*   **Bandwidth & data cost** — lean payloads, aggressive caching, WhatsApp as the low-data delivery path; media served adaptively.
*   **Devices** — mid/low-end Android dominates; PWA over heavy native; test on constrained hardware.
*   **Connectivity** — offline-tolerant clients; retries and queued sends; never assume "always online."
*   **Payments** — mobile money is primary, cards secondary; design money flows around it from the start.
*   **Deliverability** — WhatsApp opt-in, template approval and messaging limits are real constraints to design around, not afterthoughts.

* * *

## 8\. Security, privacy & compliance

*   **WhatsApp policy** — explicit learner opt-in, honour opt-out, respect template & 24-hour session rules.
*   **Data protection** — align to local regimes (Nigeria NDPR, Kenya DPA, South Africa POPIA); data-residency choices where required (see ADR-007).
*   **Roles & access** — org-scoped permissions; co-mentor roles; least-privilege on learner data.
*   **AI safety** — see §6 guardrails.

* * *

## 9\. Build vs. buy

**Build (our moat):** program model & builder · scheduling/drip · triage engine · channel abstraction · AI orchestration layer.

**Buy / integrate:** WhatsApp Cloud API (via BSP for v1) · LLM provider · payment/mobile-money aggregator (later) · S3-compatible object storage · OTP delivery · video hosting (embed, don't build).

* * *

## 10\. Technical phasing

*   **NOW** — Domain model (org-scoped) · NestJS modular monolith scaffold · WhatsApp BSP integration spike · channel abstraction · MessageTemplate model · OTP auth + refresh/access tokens · BullMQ drip engine · Signal stream + rules-based triage · AI service seam (drafting) · builder & learner portal.
*   **NEXT** — Inbound reply parsing · richer triage (model-assisted) · broadcasts/groups · assessments · public showcase pages · AI scaffolding.
*   **LATER** — Mobile-money payments · extract channel/AI to services if scale needs it · more channel adapters · social distribution · analytics · native apps if warranted · evaluate direct Cloud API migration from BSP.

* * *

## 11\. Architecture Decision Records

### ADR-001: Phone-number-first identity with OTP + refresh/access tokens
**Status:** Accepted
**Context:** Learners and creators need low-friction auth on low-connectivity, mid/low-end Android devices, in a market where phone numbers (not email) are the universal handle and also the WhatsApp address and mobile-money identifier.
**Decision:** Phone number is the primary identity key. Auth via OTP. Post-verification, issue a long-lived refresh token + short-lived access token, with silent refresh so OTP is a rare event rather than a per-login cost.
**Consequences**
*   _Positive:_ One identity anchor serves auth, messaging, and future payments. Minimal login friction on repeat visits, which matters on flaky connections.
*   _Negative:_ SMS/OTP delivery cost and reliability becomes a dependency; need a fallback (e.g., WhatsApp OTP delivery) if SMS gateways are unreliable in a given market.
*   _Neutral:_ Email becomes optional metadata, not an identity path — fine for v1, but corporate L&D buyers (§2 of brief) may expect email-based SSO eventually.

* * *

### ADR-002: Modular monolith on NestJS
**Status:** Accepted
**Context:** Team is small/mixed-skill; premature microservices add operational overhead without a scale problem to justify it. But the product has real seams (channel, AI) that must not leak into core logic.
**Decision:** Single deployable NestJS application. Each domain area (Programs, Enrollment, Scheduling, Messaging/Channel, AI, Payments) is a distinct Nest module with an explicit public interface (exported providers); internal implementation stays private to the module. No cross-module direct database access — modules talk through injected services only.
**Consequences**
*   _Positive:_ Framework-enforced module boundaries (not just convention) make the channel/AI seams hard to violate accidentally. Single deploy, single migration path, simple ops for v1.
*   _Negative:_ A careless developer can still bypass module boundaries if not enforced in code review / lint rules; needs a lightweight architectural test (e.g., dependency-cruiser rule) to catch cross-module imports.
*   _Neutral:_ Extraction to services later is possible but not free — Messaging and AI are the two modules designed to extract first if scale demands it.

* * *

### ADR-003: Channel-only engagement (no in-app chat)
**Status:** Accepted
**Context:** Building a real-time in-app chat inbox would duplicate WhatsApp, add a second surface learners must be pulled into, and contradicts "create & forget."
**Decision:** All 1:1 and cohort conversation happens on WhatsApp (and future channel adapters). Fundi composes, schedules, and records; it does not host live conversation UI.
**Consequences**
*   _Positive:_ One less surface to build, secure, and keep learners engaged in. Matches where learners already are.
*   _Negative:_ No native record of conversation inside the app beyond what's parsed back as InboundEvents — full conversational nuance lives in WhatsApp, not Fundi.
*   _Neutral:_ Premium 1:1 coaching may eventually want a native thread; deferred, not ruled out.

* * *

### ADR-003a: In-app "ask for help" as structured Signal capture, not chat
**Status:** Accepted
**Context:** ADR-003 correctly keeps live conversation on WhatsApp, but leaves no in-app affordance for a learner who wants help right now and doesn't want to leave the app to start a WhatsApp thread. A generic in-app chat bubble would reverse ADR-003 and duplicate WhatsApp; doing nothing leaves a real gap in the learner experience.
**Decision:** Add a help bubble/affordance in the learner app that opens a short structured capture form (what do you need help with, optionally scoped to the current lesson) rather than a chat surface. Submitting it emits a `help_requested` Signal (already defined in §3/ADR-010) directly into the Triage queue, surfacing the learner to their mentor immediately. The mentor's actual reply is sent as an outbound WhatsApp message via the existing Channel Service — Fundi still never hosts the live conversation. This reuses the Signal → Triage pipeline that's already being built for ADR-010, rather than introducing new infrastructure.
**Consequences**
*   _Positive:_ Learner gets a real, confirmed "I asked for help" moment in-app without Fundi becoming a chat surface. No new subsystem — rides on Signal/Triage already in scope. Mentor sees help requests in the same queue as every other exception, so nothing new to check.
*   _Negative:_ The help request and the mentor's WhatsApp reply aren't visually linked back for the learner by default — a learner who submits a request has to go check WhatsApp to see the answer, same as any other Fundi-initiated message.
*   _Neutral:_ A fast-follow (mirroring the mentor's WhatsApp reply back into a read-only "your question" card in the learner app) is a natural next step if learners re-open the app to check on requests — deferred, not designed here. A `wa.me` deep-link as a secondary "or message us directly" fallback is worth keeping alongside the structured form, at negligible cost.

* * *

### ADR-004: WhatsApp delivery — BSP vs. direct Cloud API
**Status:** Accepted for v1 (BSP), revisit at scale
**Context:** Meta's direct Cloud API requires Meta Business verification, direct number registration, and self-managed template submission — all of which carry real onboarding latency (days to weeks) and support burden. A Business Solution Provider (e.g., 360dialog, Twilio) sits in front of the same underlying Cloud API and absorbs onboarding, sandboxing, and account management, at the cost of a per-message or per-seat markup and one more vendor in the chain.

|  | Direct Cloud API | BSP (360dialog/Twilio-class) |
| ---| ---| --- |
| Onboarding speed | Slow — Meta Business verification, manual review | Fast — BSP handles verification, often has pre-vetted paths |
| Cost | Meta's per-conversation pricing only | Meta's pricing + BSP markup/seat fee |
| Support | Meta support (limited, self-serve) | BSP support (usually more responsive) |
| Template management | Self-submitted to Meta, self-managed | Often has tooling/dashboards to manage templates |
| Sandbox/test numbers | Harder to get working quickly | Usually available immediately |
| Long-term cost at scale | Lower — no middleman markup | Higher — ongoing BSP fee |
| Control | Full control, no intermediary | Dependent on BSP's API stability and roadmap |

**Decision:** Use a BSP for v1. Onboarding speed matters more than marginal cost while proving the wedge (§13 of brief: build → invite → remind, end to end). Wrap it behind the same internal channel interface as direct API would use, so switching later is a channel-service config change, not a core rewrite.
**Consequences**
*   _Positive:_ Faster time to first working WhatsApp send; lower support burden while the team is small.
*   _Negative:_ Ongoing BSP fee; a second vendor relationship and a dependency on their API uptime/versioning.
*   _Neutral:_ Migration to direct API later is a contained change if the channel abstraction is respected — worth revisiting once volume makes the BSP markup material.

* * *

### ADR-005: Message templating as a first-class entity
**Status:** Accepted
**Context:** Meta enforces that outbound business-initiated messages sent outside a 24-hour customer-service window must use pre-approved templates with fixed structure and named variable slots — free-form text cannot be sent in that window regardless of who or what authored it. Since Fundi's core behavior is proactive reminders sent well outside any recent reply window, most outbound traffic falls under this rule. This directly intersects with "AI drafts messages in the coach's voice."
**Decision:** Introduce a `MessageTemplate` entity: one row per Meta-approved template, versioned, with declared variable slots. The AI drafting capability fills variables within an approved template when sending outside the 24h window, and may draft genuinely free text only for replies sent inside an active 24h window (e.g., responding to a learner's question). The Messaging module is the only place that knows which regime applies to a given send.
**Consequences**
*   _Positive:_ Keeps Fundi compliant with WhatsApp policy by construction rather than by developer discipline. AI drafting has a clear, testable contract (fill these variables) instead of an open-ended one.
*   _Negative:_ Every new "kind" of proactive message (new reminder type, new nudge style) requires a template submitted to Meta and approved before it can ship — this is a real lead-time cost that needs to be planned into feature rollout, not discovered at launch.
*   _Neutral:_ Coaches will likely want to see/approve template variants, not just individual messages — a small UI surface, not a schema problem.

* * *

### ADR-006: Tech stack — Node.js/TypeScript, NestJS, React/Next.js, Postgres, Redis/BullMQ
**Status:** Accepted
**Context:** Team is mixed-skill with no strong existing stack preference. The product needs: a modular monolith with enforceable boundaries, a durable job/queue system for drip and reminders, a relational domain model with some flexible content fields, and both a creator web app and a low-bandwidth learner PWA.
**Decision:**
*   **Backend:** NestJS (Node.js/TypeScript) — module system maps directly onto the required architectural boundaries (§4.2/ADR-002).
*   **Frontend:** React + Next.js for creator app, learner PWA, and public showcase pages — SSR/SSG helps showcase-page SEO and initial load on low-end devices; one framework covers all three client surfaces.
*   **Database:** PostgreSQL — relational fit for the domain model (§3), JSONB columns where lesson content needs flexibility.
*   **ORM:** Prisma.
*   **Queue:** Redis + BullMQ for DripJobs, retries, and scheduled sends.
*   **Language:** TypeScript everywhere — one language across API, web, and PWA.

**Consequences**

*   _Positive:_ A single language lowers the bar for any engineer to work across the stack, which matters most for a mixed-skill team. Mature ecosystem for all the pieces this product needs (WhatsApp SDKs, job queues, Postgres tooling).
*   _Negative:_ NestJS has a steeper initial learning curve than a minimal Express app for engineers unfamiliar with DI-style frameworks — worth a short internal ramp-up.
*   _Neutral:_ This is a mainstream, unopinionated-enough choice that it doesn't foreclose future extraction to other languages/services for isolated capabilities (e.g., a Python service for heavier ML work later, if ever needed).

* * *

### ADR-007: Hosting — AWS, region-flexible with af-south-1 fallback
**Status:** Proposed
**Context:** No committed hosting region yet; data-residency requirements (NDPR, Kenya DPA, POPIA) may harden as the product signs larger orgs, but aren't a hard constraint today.
**Decision:** Host on AWS. Start in a standard region (e.g., `eu-west-1` or `us-east-1`) for lowest initial cost/complexity; treat `af-south-1` (Cape Town) as the designated fallback if/when a specific market or customer requires in-region data residency. Use RDS (Postgres), ElastiCache (Redis), S3 for media, ECS Fargate or App Runner for the app container — avoid Kubernetes at this scale.
**Consequences**
*   _Positive:_ Mature managed services reduce ops burden for a small team; clear path to regional migration if required without an architecture change (containerized app, managed data stores are portable).
*   _Negative:_ `af-south-1` has fewer managed-service options and higher baseline cost than larger AWS regions — a real migration cost if triggered.
*   _Neutral:_ This is a hosting choice, not an architecture one — revisit purely on cost/compliance grounds, not code changes.

* * *

### ADR-008: Multi-tenancy — shared database, org-scoped rows
**Status:** Accepted
**Context:** Every core entity belongs to an Organisation. Strong per-tenant database isolation (DB-per-org) is unnecessary operational overhead at this stage and premature before any org is large enough to demand it.
**Decision:** Single shared database. Every tenant-scoped table carries a required `organisation_id`. Scoping is enforced at the query/repository layer (e.g., a Prisma middleware or repository base class that injects the org filter), not left to individual query authors to remember.
**Consequences**
*   _Positive:_ Simple operationally (one database to manage, back up, migrate). Cheap to run at v1 scale.
*   _Negative:_ A missed scoping check is a cross-tenant data leak — this needs to be a tested, enforced pattern (middleware + tests), not a convention.
*   _Neutral:_ Larger orgs can be moved to dedicated schemas or databases later without a domain-model change, since `organisation_id` is already the scoping key everywhere.

* * *

### ADR-009: Scheduling & drip via durable job queue
**Status:** Accepted
**Context:** Cohort start dates, per-learner drip (self-paced vs. cohort calendar), reminder retries, and timezone handling across African markets are the operational core of "create and forget." A missed send is a broken product promise, not a minor bug.
**Decision:** BullMQ on Redis for all scheduled and retryable work (`DripJob`). Jobs are idempotent, retried with exponential backoff, and timezone-aware per learner/cohort. No cron-on-a-box for anything learner-facing.
**Consequences**
*   _Positive:_ Durable, inspectable, retryable — failures are visible and recoverable rather than silent.
*   _Negative:_ Adds Redis as a required piece of infrastructure (already needed for BullMQ regardless — see ADR-006).
*   _Neutral:_ This queue is a natural extraction point if Messaging is later pulled into its own service.

* * *

### ADR-010: Attention triage via Signal stream + rules-based scoring
**Status:** Accepted for v1, model-assisted scoring proposed for later
**Context:** "Needs you" is the product's central management-by-exception promise. It needs to work from day one, before there's enough reply/interaction data to train or justify a model, and it needs to be explainable to a coach who's trusting it to surface the right 6 people out of 200.
**Decision:** Introduce an append-only `Signal` stream (`lesson_overdue`, `reminder_unacknowledged`, `quiz_failed`, `help_requested`, `went_quiet`, etc.), emitted by the core domain and by inbound WhatsApp events. A rules-based scoring pass over Signals produces the "Needs you" queue ranking in v1. The Signal schema is the shared contract — later model-assisted ranking consumes the same stream, so v2 is an upgrade to the scoring function, not a new data pipeline.
**Consequences**
*   _Positive:_ Cheap, explainable, works from day one with zero training data. Coaches can see _why_ someone surfaced (which signal fired), which builds trust in the exception queue.
*   _Negative:_ Rules-based scoring will miss subtler patterns a model might catch (e.g., gradual disengagement across several small signals) — accepted tradeoff for v1.
*   _Neutral:_ This is the most product-critical piece of the system after the channel abstraction; worth investing real design time in the specific rule set before build, separate from this ADR.

* * *

### ADR-011: AI as an isolated internal service
**Status:** Accepted
**Context:** AI touches multiple capabilities (drafting, triage, scaffolding) across multiple modules; without a boundary, prompt logic and provider specifics leak into domain code and become impossible to swap, audit, or guardrail consistently.
**Decision:** One internal AI service module owns all LLM calls: prompt templates, guardrails (no unnecessary learner PII in prompts), cost caps, output logging, and a provider-swap seam (hosted LLM via API, not self-hosted, for v1). All AI output is logged and requires human/rule approval before reaching a learner, per the messaging-template constraint in ADR-005.
**Consequences**
*   _Positive:_ Single place to change LLM providers, add guardrails, or audit what AI has ever said to a learner.
*   _Negative:_ Adds a layer of indirection other modules must call through rather than hitting an LLM API directly — intentional friction, worth the cost.
*   _Neutral:_ Cost ceiling per creator/month (flagged as open in the original doc) is a policy the AI service should enforce, not a separate architectural concern.

* * *

### ADR-012: Two separate PWAs (creator, learner) sharing one codebase — not native, not unified
**Status:** Accepted
**Context:** Creators and learners have distinct usage patterns — creators use a dense, frequent builder/dashboard/triage surface; learners use a light, infrequent progress/lesson-viewing surface, with WhatsApp carrying most of their actual engagement (per §4.4 and the product brief's "portal stays light" direction). The question of native vs. PWA, and one app vs. two, needed a decision before frontend work starts.
**Decision:** Build two separately deployed, separately bundled installable PWAs — a creator app and a learner app — sharing a common design-system package and the same NestJS API, structured as a monorepo (e.g., Turborepo with `apps/creator`, `apps/learner`, `packages/ui`). No native app for v1.
**Consequences**
*   _Positive:_ Learner bundle stays genuinely thin (no builder/dashboard code shipped to a phone that doesn't need it) — matters directly for the bandwidth/low-end-device constraints in §7. Each app can evolve its own information architecture without compromise. No app-store review cycles slowing "create and forget" iteration; installable via browser prompt like any PWA.
*   _Negative:_ Two deployed frontends to maintain instead of one, and two install prompts a user might encounter if they're both a mentor and enrolled learner — an acceptable, normal pattern (comparable to separate employee/customer apps from the same company).
*   _Neutral:_ Revisit native only if a specific requirement emerges that PWA genuinely can't meet (e.g., deep background push beyond what WhatsApp already provides, or true offline video caching at a scale service workers can't handle) — not before.

* * *

### ADR-013: Monorepo tooling — pnpm workspaces + Turborepo
**Status:** Accepted
**Context:** ADR-012 commits to a Turborepo-style monorepo (`apps/creator`, `apps/learner`, `apps/api`, `packages/ui`) but doesn't lock the package manager or task runner. ADR-002's module-boundary enforcement (no cross-module leakage inside the NestJS app) is an internal-to-`apps/api` concern; the equivalent risk exists one level up, at the workspace level — a flat `node_modules` (as npm and classic yarn produce) could let one app or package silently resolve a dependency it never declared, only to break when that transitive dependency shifts underneath it.
**Decision:** Use **pnpm** for package management and **Turborepo** for task orchestration and caching. pnpm's non-flat, symlinked `node_modules` enforces that each package can only resolve dependencies it explicitly declares in its own `package.json` — extending the ADR-002 boundary discipline from the module level to the workspace level, by construction rather than convention. Turborepo provides dependency-graph-aware builds, lint, and test runs (with local caching now, remote caching optional later) across `apps/*` and `packages/*`, so a change scoped to one app doesn't re-run work for the others.
**Consequences**
*   _Positive:_ Phantom-dependency bugs are structurally prevented, not just caught by lint or code review. Turborepo's task graph keeps CI fast as the repo grows — a PR touching only `apps/learner` doesn't rebuild or retest `apps/api`. The native `workspace:*` protocol gives clean internal dependencies for `packages/types` and `packages/ui` without an internal npm registry or publish step.
*   _Negative:_ pnpm's strict resolution can surface phantom-dependency errors that engineers coming from npm/yarn don't expect on their first install — a small onboarding-friction cost, same category as ADR-006's NestJS ramp-up, worth a line in `CONTRIBUTING.md` rather than left for someone to discover cold.
*   _Neutral:_ `packages/config` (shared eslint/tsconfig/prettier base) should be modeled as a proper workspace package that other packages `extend`, not root-level files referenced by relative path — keeps the dependency graph explicit rather than implicit, consistent with the reasoning above.

* * *

## 12\. Open technical questions (remaining)

*   **LLM provider selection** — which model, and cost ceiling per creator/month. Needs a decision but doesn't block v1 build (AI service seam makes this swappable).
*   **Media hosting depth** — embed-only (YouTube etc.) vs. hosted uploads for video. Brief leans embed-only for v1; confirm before building attachment/video lesson types.
*   **Specific triage rule set** — ADR-010 locks the _mechanism_ (Signal stream + rules scoring); the actual rules (thresholds, which signals combine, how staleness is weighted) need a focused design pass with product before implementation.
*   **BSP vendor selection** — ADR-004 locks the _approach_; which specific BSP (360dialog, Twilio, MessageBird, etc.) needs a short evaluation against template-management tooling and pricing.

* * *

## Notes for engineering

*   Every new PR touching a tenant-scoped table must include `organisation_id` — enforced via repository base class, not code review memory (ADR-008).
*   No direct WhatsApp/Meta API calls outside the Messaging module. No direct LLM API calls outside the AI module. These are the two boundaries that must not leak (§1, ADR-002, ADR-011).
*   `MessageTemplate` and `Signal` are new entities not in the original domain sketch — model these alongside Program/Enrollment/Progress from the start (§3, ADR-005, ADR-010).
*   Use `pnpm`, not `npm`/`yarn`, for all installs — the strict dependency resolution is load-bearing for the workspace boundary, not a style preference (ADR-013).
*   Cross-reference the `Product Brief` for scope, the MVP cut line (§13), and the "Needs you" exception-queue behaviour the triage engine powers.
