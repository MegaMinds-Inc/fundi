> **Source:** ClickUp — Product Documentations › Product Brief ([link](https://app.clickup.com/90152626041/docs/2kyr7tvt-535/2kyr7tvt-95))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

> **Source:** Design-session handoff · Product Brief v0.2 draft · Jul 2026

# Fundi

The AI-powered, create-and-forget platform that turns talent into structured programs — delivered and driven through WhatsApp.

This brief captures the product direction for Fundi so design, engineering and product teams share one picture of what we're building and why. It is a living draft — meant to be refined, argued with, and built on.

**Market:** Africa-first · **Direction:** Pulse (dark + light) · **Platform:** Web + mobile · **Status:** Refined → build-ready

## 01 · What Fundi is

Fundi lets any creator, educator or mentor **build a course or program once**, invite their people, and let the system **run the whole delivery** — reminders, content drip, check-ins and assessments — mostly over WhatsApp. The creator focuses only on the moments where their expertise matters; **AI and automation handle the rest** — the drafting, tracking, nudging and administration that usually eats their time.

## 02 · Who it's for

*   **Independent creators & coaches** — Solo experts monetising skills — fitness, business, faith, craft. Little time for admin.
*   **Educators & teachers** — Structuring lessons into programs, running cohorts, quizzing and assessing learners.
*   **Corporate trainers / L&D** — Onboarding and upskilling staff at scale, tracking completion, keeping teams accountable.

**Every creator starts as an organisation** — so they can add co-mentors and grow into a team without migrating later.

## 03 · The problem

Experts are great at teaching and terrible at chasing. Today they stitch together WhatsApp, spreadsheets, Google Drive and payment links — and drown in manual tracking:

*   Content lives in scattered files; there's no **structure** a learner can follow.
*   Reminders are manual, so learners stall and programs have low completion.
*   The coach has no single view of **who is behind and who needs them**.
*   Existing tools (Teachable, Kajabi) assume web-app learners and card payments — wrong fit for African, WhatsApp-and-mobile-money reality.

## 04 · Product principles

1. **Create & forget** — The creator's effort goes into content and expertise. Everything downstream runs itself.
2. **Manage by exception** — Automation carries the on-track majority. Fundi surfaces only the few learners who need a human.
3. **Meet people on WhatsApp** — Conversation lives where learners already are. Fundi orchestrates; the channel carries it.
4. **AI does the busywork** — Drafting messages, triaging who needs attention, shaping content — AI removes the effort that isn't the creator's craft.

## 05 · How Fundi thinks — core objects

The mental model everyone should share. These are the nouns the whole product is built on.

**Organisation → Program → Module → Lesson · Assessment**

*   **Organisation** — every creator's home; holds mentors, branding, billing.
*   **Mentors** — the org's coaches/teachers who build and run programs.
*   **Program** — a course or track. Has a shape (self-paced, cohort, 1:1, workshop, hybrid) and can be public or private (approval-gated).
*   **Module → Lesson** — ordered structure; lessons carry the actual content.
*   **Cohort & Enrollment** — who's taking it, on what schedule.
*   **Learner** — the person progressing; reachable in-app and on WhatsApp.
*   **Assessment** — optional quizzes / end-of-session checks when the creator wants them.

## 06 · Lesson / module types

**MVP set** — enough to get a real course through end to end.

*   **Text** — Written lessons, notes, instructions
*   **Video** — YouTube & other sources embedded
*   **Attachments** — PDF, PPT, DOCX resources
*   **Live / online session** — Scheduled video meeting
*   **In-person** — Physical session with place & time
*   **Quiz / assessment** — Optional, when the creator wants it

## 07 · Program shapes

Self-paced · Cohort-based (scheduled) · 1:1 mentorship / coaching · Live workshops + material · Hybrid

## 08 · Engagement & messaging strategy (recommendation)

The most important architectural decision. Recommendation: **Fundi orchestrates the training experience; WhatsApp carries the conversation.** We do not build an in-app real-time chat inbox — it would contradict the "create & forget" promise and add friction for learners who already live on WhatsApp.

**Fundi owns:** Structure & content · scheduling & drip · reminders & nudges · progress & streaks · assessments · **composing** broadcasts & check-ins (with AI drafts) · the record of what was sent and what came back.

**The channel carries:** 1:1 and cohort-group conversation, delivery of micro-lessons, replies (DONE / questions / quiz answers), announcements, enrollment & payment links.

**Management by exception:** Two-way replies are parsed back into Fundi so status updates without the coach watching chat. A single **"Needs you"** queue surfaces only learners who are behind, stuck, or asked a question — turning "track 200 people" into "handle 6 things today."

**Channel abstraction:** Build a generic **channel** layer now, even though WhatsApp is the only one live. Telegram, SMS and others plug in later with no product redesign. Cohort WhatsApp groups get composed content shot straight to the group.

**Asking for help, in-app:** Channel-only doesn't mean no in-app affordance. A learner who wants help right now taps a help bubble, fills a short structured "what do you need help with" form, and it drops straight into the coach's **"Needs you"** queue. The mentor's actual reply still goes out over WhatsApp — Fundi never hosts the live conversation.

**Resolved:** channel-only, confirmed. WhatsApp delivery for v1 goes through a Business Solution Provider (BSP) rather than direct Cloud API — faster onboarding while proving the wedge; revisit direct API once volume makes the BSP markup material.

## 09 · AI capabilities

AI reduces creator effort — it never becomes the teacher. Where it earns its place:

*   **Program scaffolding** — Turn a topic or outline into a draft module/lesson structure
*   **Message drafting** — Draft reminders, check-ins, broadcasts in the coach's voice
*   **Quiz generation** — Suggest assessment questions from lesson content
*   **Attention triage** — Decide who needs a human and suggest the next action

## 10 · Monetisation

*   **Free programs** — community, nonprofit, internal training.
*   **One-time sale** — pay once for a program.
*   **Subscriptions / memberships** — ongoing access.
*   **Private / approval-gated programs** — the interim path to paid: coach approves each learner before access. A pragmatic way to run paid cohorts before full payment rails land.
*   _Later:_ mobile-money rails (M-Pesa, MTN) and a platform cut per transaction.

## 11 · Feature map

*   **CREATE** — Program & module builder · lesson types · AI scaffolding · quizzes & assessments · public/private & approval gates
*   **DELIVER & ENGAGE** — Enroll & invite · scheduling / drip · WhatsApp reminders & nudges · two-way replies · cohort broadcasts · streaks & check-ins
*   **MANAGE** — Mentor dashboard · "Needs you" exception queue · progress & completion · cohort & learner views · org & co-mentor roles
*   **GROW** — Public showcase pages · social distribution · payments & memberships · learner portal · analytics · channel expansion (Telegram, SMS) · mobile money

## 12 · Grow & acquisition

Create, deliver and manage get learners _through_ a program. This pillar gets them **in** — two surfaces that both feed the enrollment & approval flow. A topic we'll explore deeper.

*   **Public showcase pages (NEXT)** — A creator/org storefront plus a page per course — outline, details, price, and an enroll/apply button. The front door creators share with potential clients. Pairs directly with private, approval-gated programs: visitor applies → coach approves → access.
*   **Publish-once social distribution (LATER)** — Connect social handles (Instagram, TikTok, Facebook, LinkedIn, X). Write a promo once; AI adapts it per platform; publish everywhere — always linking back to the showcase page. Traffic engine for enrollment.

**Keep two channel types distinct.** **Engagement** channels (WhatsApp / Telegram / SMS — private delivery, §8) are not the same as **marketing** channels (social — public, top-of-funnel). Social distribution stays enrollment-focused, not a general social-media tool — that's how we avoid Buffer/Hootsuite scope creep.

## 13 · MVP — the cut line

v1 goal: **build a course → invite → send reminders**, end to end, done well — with AI making creation and messaging effortless. Nothing more until that sings.

**IN v1**
*   Org sign-up (creator = org)
*   Build a program with modules
*   Lesson types: text, video, attachments, live/online, in-person
*   Invite / enroll learners
*   Automated WhatsApp reminders
*   **AI: message drafting & attention triage**
*   **"Needs you" exception queue** (progress-based)
*   Public + private (approval-gated) programs
*   Basic learner portal
*   Basic progress view

**LATER**
*   Two-way reply parsing (enriches triage)
*   AI program scaffolding
*   Cohort broadcasts & groups
*   Quizzes & assessments (+ AI quiz generation)
*   Payments, subscriptions, mobile money
*   Co-mentor roles & team management
*   Telegram / SMS channels
*   Analytics & streaks

## 14 · Rough phasing

*   **NOW — Prove the core:** Build → invite → remind, with AI message drafting and progress-based attention triage from day one. One channel (WhatsApp). Private programs for early paid cohorts.
*   **NEXT — Reduce management:** Public showcase pages, two-way reply parsing (richer triage), AI program scaffolding, broadcasts, assessments & AI quiz generation.
*   **LATER — Scale & monetise:** Payments & mobile money, social distribution, teams, more channels, analytics, deeper AI.

## 15 · Open decisions

*   **Name** — Fundi (working) vs. Somo / Njia / Kozi / Mentar.
*   **Paid access before rails** — how far "private + approval" carries us before real payments.

**Resolved in the Technical Direction:** learner identity (phone-number-first), in-app chat (channel-only, with structured in-app help-request capture), WhatsApp delivery (BSP for v1).

## 16 · For the teams

*   **Design** — Direction locked: Pulse (dark default + light). Next: full design-system sheet, then anchor screens — builder, dashboard, "Needs you," learner portal.
*   **Engineering** — Model the core objects (§5), plus Signal & MessageTemplate. Build the channel abstraction early — creator and learner ship as two separate PWAs on one API. WhatsApp (BSP) integration & reply parsing are the technical spikes. Full detail in Technical Direction.
*   **Product** — Own the MVP cut line (§13). Resolve open decisions (§15). Define completion & engagement metrics that prove the wedge.
