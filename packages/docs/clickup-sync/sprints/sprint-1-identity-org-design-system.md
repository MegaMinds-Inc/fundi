> **Source:** ClickUp — Sprints › Sprint 1 ([link](https://app.clickup.com/t/86capbyce))
> **Synced:** 2026-07-11 — manual snapshot, not live. Re-sync by asking an agent to re-run this process.

---

# Sprint 1 — Identity, Org & Design System Foundation

**Release increment goal:** A creator or learner can create an account (phone + OTP), get an org context, log in/out with silent refresh, and use either app themed with real shared components — nothing hardcoded or one-off.

**Ships & is testable as:** sign up → verify OTP → land authenticated → close app → reopen → still logged in (silent refresh) → log out. All screens use `packages/ui` tokens/components, dark + light.

**Includes (linked below):**
*   Design System: tokens (US-001), core component set (US-002), shared config (US-003)
*   Identity & Auth: phone/OTP request (US-001), OTP verify + login (US-002), refresh/access tokens (US-003), session/logout (US-004)
*   Multi-tenancy & Org Management: Organisation entity + creation on signup (US-001), repository-layer org scoping enforcement (US-002), architectural test for cross-tenant leak prevention (US-003)

**Depends on:** Sprint 0 (repo scaffolding, Prisma schema, monorepo skeleton) — Platform Infrastructure & DevOps.

**Note:** Multi-tenancy US-004 ("dependency-cruiser rule for module boundary enforcement") looks like a duplicate of Platform Infrastructure & DevOps item #4 of the same name — left out of this sprint pending a check with the tech lead on whether these are actually two different rules (module boundaries vs. tenant scoping) or one task listed twice.

## Linked stories

### [Design System] US-001: Design tokens package (color, type, spacing) — light + dark

**Story:** As a frontend engineer, I want a shared design-tokens package so that Creator PWA and Learner PWA visually stay in sync from day one.

**Acceptance Criteria**
- [x] packages/ui exposes tokens for color, typography, spacing — `packages/ui/src/tokens/*` + `styles.css`, exported as `@fundi/ui/styles.css` and `@fundi/ui/tokens/*`.
- [x] Light mode and dark mode variants both defined — dark default (unset `data-theme`) + `[data-theme="light"]` override in `colors.css`/`shadow.css`; both verified present in each app's production CSS bundle.
- [x] Mobile-first values as base; documented notes for how tokens scale — `layout.css` documents the 3-tier breakpoints/grid; notes in `packages/ui/README.md`.

**Notes:** Points: 5 — see `packages/docs/features/0005-design-system-tokens-and-components.md`.

**Status:** shipped · **Priority:** none · **ClickUp:** [86cap8u1g](https://app.clickup.com/t/86cap8u1g)

---

### [Design System] US-002: Core component set (Button, Input, Card, etc.)

**Story:** As a frontend engineer, I want a base set of shared components so that both PWAs don't rebuild the same primitives independently.

**Acceptance Criteria**
- [x] Button, Input, Card, Badge, Tag, Tabs, Modal, Drawer, EmptyState built in `packages/ui` (9 primitives) — `packages/ui/src/components/*.tsx`, all exported from `src/index.ts`.
- [x] Each has light + dark mode support (dark default via unset `data-theme`; light via `data-theme="light"` — same semantic tokens, no component-layer branching) — components style purely via `var(--…)`; creator renders dark, learner renders light, both from the identical component code.
- [x] Mobile-first layout; documented behavior/notes for larger screens — `packages/ui/README.md` per-component notes; `Drawer` is the mobile-first bottom-sheet counterpart to `Modal`.
- [x] Published as a `workspace:*` package consumable by `apps/creator` and `apps/learner` — both consume via `workspace:*` + `transpilePackages`; demo pages rebuilt on the components.

**UNBLOCKED — 2026-07-11:** screen sync is complete. Final component inventory, confirmed against all 5 delivered UI kits (Needs You queue, Enrollment, Learner Progress, AI Draft Review, Auth Flow):
*   **Button** — primary/secondary/ghost/danger, sm/md/lg, icon-only circular mode
*   **Input** — label, icon slots, circular send-action button, error/helper text
*   **Card** — media slot, title/meta header, footer, interactive hover-lift
*   **Badge** — status pill, tone-coded (live/draft/warn/danger/neutral) — used directly by `SignalBadge` and `EnrollmentBadge`
*   **Tag** — curated color set, selectable, removable — used by the triage queue's filter bar
*   **Tabs** — pill/underline/boxed, animated indicator — used by Cohort tabs
*   **Modal** — scrim, title, footer actions
*   **Drawer** — mobile-first bottom action sheet — **load-bearing**: `ActionSheet`, `HelpCapture`, and `DraftEditor` all wrap this directly. Screen work in Needs You, Learner Progress, and AI Draft Review cannot start without it.
*   **EmptyState** — icon + heading + body — used by the triage queue's "no one needs you," the enrollment empty state, and the AI draft queue's "nothing waiting on you"

**Sequencing note:** all 19 screen-level stories now in Signals & Attention Triage / Enrollment & Cohort Management / Progress & Assessments / AI Drafting & Triage Service reference `window.FundiDesignSystem_1eab67` components directly — this story is a hard prerequisite for all of them, not just a nice-to-have. Recommend this lands in Sprint 1 alongside US-001/US-003.

Points: 8 — see `packages/docs/features/0005-design-system-tokens-and-components.md`.

**Status:** shipped · **Priority:** none · **ClickUp:** [86cap8u3b](https://app.clickup.com/t/86cap8u3b)

---

### [Design System] US-003: packages/config — shared eslint/tsconfig/prettier base

**Story:** As an engineer, I want shared lint/tsconfig/prettier config as a proper workspace package so that apps/* and packages/* extend a single source of truth rather than referencing root files by relative path.

**Acceptance Criteria**
- [x] packages/config exists as a workspace:* package — delivered in Sprint 0 Task 2 (see `0001-sprint-0-foundation.md`).
- [x] apps/creator, apps/learner, apps/api all extend from it — via `workspace:*` (eslint/tsconfig/prettier variants).
- [x] No relative-path references to root config files remain.

**Notes:** ADR-013 consequence. Points: 3. Delivered ahead of Sprint 1 as part of Sprint 0 scaffolding.

**Status:** shipped · **Priority:** none · **ClickUp:** [86cap8u51](https://app.clickup.com/t/86cap8u51)

---

### [Identity & Auth] US-001: Phone number + OTP request flow

**Story:** As a new user (creator or learner), I want to enter my phone number and receive an OTP so that I can verify my identity without a password.

**Acceptance Criteria**
- [ ] User enters phone number in E.164-compatible input
- [ ] OTP sent via SMS gateway (fallback: WhatsApp OTP delivery per ADR-001 negative)
- [ ] Rate-limited to prevent OTP abuse
- [ ] Clear error state if number is invalid or send fails

**Notes:** Phone number is the identity anchor (ADR-001, locked). Points: 5

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8ttg](https://app.clickup.com/t/86cap8ttg)

---

### [Identity & Auth] US-002: OTP verification + account creation/login

**Story:** As a user, I want to submit the OTP I received so that I'm logged in (or a new account is created if this is my first time).

**Acceptance Criteria**
- [ ] Correct OTP creates a new user record if phone number is unrecognized
- [ ] Correct OTP logs in an existing user
- [ ] Incorrect OTP shows a clear error, allows retry within limit
- [ ] Expired OTP prompts a resend option

**Notes:** Points: 5

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8tu8](https://app.clickup.com/t/86cap8tu8)

---

### [Identity & Auth] US-003: Long-lived refresh + short-lived access token issuance

**Story:** As a returning user, I want to stay logged in across sessions without re-entering an OTP every time, so that login friction is low on repeat visits.

**Acceptance Criteria**
- [ ] Access token short-lived, refresh token long-lived, issued together post-verification
- [ ] Silent refresh renews access token without user action
- [ ] Refresh token revocation supported (logout, security event)
- [ ] Expired refresh token forces a new OTP flow

**Notes:** Points: 8

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8tv5](https://app.clickup.com/t/86cap8tv5)

---

### [Identity & Auth] US-004: Session/logout handling across Creator and Learner PWAs

**Story:** As a user with both a creator and learner account context (e.g. mentor who is also enrolled somewhere), I want session handling to work correctly across both PWAs, so that logging out of one doesn't unexpectedly break the other if I don't want it to.

**Acceptance Criteria**
- [ ] Logout is scoped per app by default
- [ ] Token storage approach documented for both PWAs (no localStorage misuse — secure storage only)
- [ ] Auth state correctly reflected in each app's UI

**Notes:** Points: 3

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8twm](https://app.clickup.com/t/86cap8twm)

---

### [Multi-tenancy & Org Management] US-001: Organisation entity + creation on signup

**Story:** As a new creator, I want an Organisation to be created automatically when I sign up, so that everything I build is scoped to my org from the start.

**Acceptance Criteria**
- [ ] Organisation record created on first creator signup
- [ ] organisation_id generated and available for all subsequent writes
- [ ] One creator can belong to (and switch between) multiple orgs — confirm this is in/out of v1 scope with product before building

**Notes:** Points: 5

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8txw](https://app.clickup.com/t/86cap8txw)

---

### [Multi-tenancy & Org Management] US-002: Repository-layer org scoping enforcement

**Story:** As an engineer, I want organisation_id scoping enforced automatically at the query/repository layer, so that a missed manual filter can never cause a cross-tenant data leak.

**Acceptance Criteria**
- [ ] Prisma middleware or repository base class injects org filter on all tenant-scoped table queries
- [ ] Attempting to query without org context throws/fails loudly, not silently
- [ ] Documented pattern in CONTRIBUTING.md / engineering docs (repo /docs)

**Notes:** ADR-008. This is the epic's core deliverable. Points: 8

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8tyf](https://app.clickup.com/t/86cap8tyf)

---

### [Multi-tenancy & Org Management] US-003: Architectural test for cross-tenant leak prevention

**Story:** As an engineering team, we want automated tests that fail CI if a tenant-scoped query bypasses org scoping, so that this isn't relied on for code review memory alone.

**Acceptance Criteria**
- [x] Test suite includes at least one deliberate "forgot org filter" case that must fail without the middleware — `apps/api/src/prisma/org-scope.test.ts` (`scopeOperation` throws `MissingOrgContextError` when unscoped) + the DB-backed `org-isolation.integration.test.ts`.
- [x] CI blocks merge on failure — `.github/workflows/ci.yml` runs the suite (with a Postgres service so the integration test executes) on every PR; make it a required check via branch protection. See `0006-render-supabase-github-cicd.md`.
- [x] Covers every current tenant-scoped table — `TENANT_SCOPED_MODELS` completeness test asserts it matches the schema's `organisation_id` tables.

**Notes:** ADR-008 negative-case coverage. Points: 5. Test coverage landed with the Sprint-0 close (see `0003`/`0004`); the CI gate wiring landed with `0006`.

**Status:** backlog · **Priority:** none · **ClickUp:** [86cap8tz8](https://app.clickup.com/t/86cap8tz8)

---

### [Product Documentations] Process: Sprint completion → release-increment doc (cross-cutting, not a delivery story)

Linked from all four sprints (1–4), not specific to Sprint 1 — included here for completeness since it's a real linked task, not a duplicate/self-reference (an earlier sync pass incorrectly treated the ambiguous `task_id`/`link_id` pairing on this entry as self-referential and dropped it; verified by direct fetch that it's a distinct task).

**Process:** When a Sprint (in the Sprints folder) is fully done — every linked story shipped and tested per the sprint task's "ships & is testable as" criteria — do the following instead of just leaving it sitting closed in the folder:

1. **Write a short release-increment doc** covering: what shipped (the story list, as already linked on the sprint task), what got tested and how, any decisions/deviations made mid-sprint that weren't in the original story ACs, and any follow-on items it surfaced (bugs, "later" items, new spikes). This lives in **Product Documentations**, one doc per sprint.
2. **Close the sprint task** in its Sprints-folder list once the doc exists and is linked back from the sprint task (and the doc links back to the sprint task).
3. The underlying story tasks stay in their domain lists (Signals & Attention Triage, Enrollment & Cohort Management, etc.) at whatever status reflects reality (`shipped`/closed) — the sprint task closing doesn't change those, it's just the release-increment wrapper.

This keeps the Sprints folder as a live view of what's in-flight/next, while Product Documentations accumulates the actual record of what shipped and why — useful for onboarding, and for reconstructing "why did we build it that way" later.

**Current state (2026-07-11):** Sprints 1–4 are all open, nothing shipped yet, so nothing to convert yet. Applies going forward as each one closes out.

**Status:** backlog · **Priority:** normal · **ClickUp:** [86capbyng](https://app.clickup.com/t/86capbyng)

---
