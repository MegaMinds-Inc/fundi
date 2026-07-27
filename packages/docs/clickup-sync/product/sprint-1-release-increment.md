> **Source:** ClickUp — Product Documentations › Release Increments › Sprint 1 (manual doc; first of the per-sprint series).
> **Written:** 2026-07-24 — manual snapshot, not a live ClickUp sync.
> **Sprint task:** Sprints › [Sprint 1](https://app.clickup.com/t/86capbyce) → tracker: [`sprints/sprint-1-identity-org-design-system.md`](../sprints/sprint-1-identity-org-design-system.md).

---

# Sprint 1 — Release Increment: Identity, Org & Design System Foundation

> **Process ref:** the cross-cutting "Sprint completion → release-increment doc" task ([86capbyng](https://app.clickup.com/t/86capbyng)). This is the wrapper written when a sprint's linked stories are all shipped: what shipped, what was tested, decisions/deviations vs. the original ACs, and follow-ons surfaced.

## 1. Increment goal — met (code-complete)

> *A creator or learner can create an account (phone + OTP), get an org context, log in/out with silent refresh, and use either app themed with real shared components — nothing hardcoded or one-off.*

Delivered and verified in code. Testable as: sign up → verify OTP → land authenticated → close app → reopen → still logged in (silent refresh) → log out. All screens use `packages/ui` tokens/components, dark (creator) + light (learner).

**Release caveat:** delivery is code-complete and test-verified, but **not yet committed** and **not yet deployed** — see the pre-release checklist in §5 before this is a true release.

## 2. What shipped (10 delivery stories)

All ten Sprint 1 delivery stories are marked `shipped` in the tracker with per-AC code evidence. Grouped by epic:

**Design System** (feature [0005](../../features/0005-design-system-tokens-and-components.md)) — *shipped in/ahead of Sprint 1:*
- **US-001** Design tokens (color/type/spacing, light + dark) — `packages/ui/src/tokens/*` + `styles.css`.
- **US-002** Core component set (9 primitives: Button, Input, Card, Badge, Tag, Tabs, Modal, Drawer, EmptyState) — `packages/ui/src/components/*`.
- **US-003** `packages/config` shared eslint/tsconfig/prettier — delivered in Sprint 0.

**Identity & Auth** (features [0008](../../features/0008-sprint-1-auth-and-org-scoping.md) pipeline · [0009](../../features/0009-otp-sms-delivery-vynfy.md) SMS · [0010](../../features/0010-device-trust-and-pin-step-up-reauth.md) device-trust/PIN):
- **US-001** Phone + OTP request — E.164 normalization, Vynfy SMS delivery, per-phone + per-IP + global-budget rate limits.
- **US-002** OTP verify + account create/login — `verifyOtp` `upsert` (signup==login), attempt cap, expiry + resend cooldown.
- **US-003** Refresh + access tokens — 15 min access / 30 day refresh, rotating with reuse-detection, proactive silent refresh, revocation.
- **US-004** Session/logout across PWAs — per-app scoping, httpOnly `__Host-` cookies via the BFF, auth state via middleware/resolver/`/auth/me`.

**Multi-tenancy & Org** (feature [0008](../../features/0008-sprint-1-auth-and-org-scoping.md), ADR-008):
- **US-001** Organisation entity + creation on signup — `onboard` bootstraps Organisation + owner Mentor + Membership.
- **US-002** Repository-layer org scoping — `apps/api/src/prisma/org-scope.ts` client extension; pattern in `CONTRIBUTING.md` rule 2.
- **US-003** Architectural test for cross-tenant leak — `org-scope.test.ts` + `org-isolation.integration.test.ts`, gated in CI.

## 3. What was tested, and how

- **Backend unit + integration** (`node:test`): the auth module passes **104/104** with the stub OTP driver — OTP lifecycle, token rotation (idle/absolute-cap/reuse/race code paths), PIN hashing + pepper + per-device self-healing lockout, trusted-device issue/verify/rotate/revoke, weak-PIN blocklist, PIN step-up, forgot-PIN reset, and the H1 refresh-race grace window.
- **Org-scoping**: `org-scope.test.ts` completeness (both directions vs. schema) + DB-backed `org-isolation.integration.test.ts`; `MissingOrgContextError` / `CrossTenantWriteError` negative cases. CI runs these with a Postgres service.
- **Frontend**: `apps/api` `tsc` exit 0; both apps `tsc --noEmit` exit 0; `@fundi/ui` `build-storybook` exit 0. UI screens verified via **both-theme visual Storybook stories** + a manual-QA checklist.
- **Security**: multiple adversarial reviews across the auth build — 7 must-fixes verified landed, plus focused re-reviews of the H1 (refresh-race), H2 (forgot-PIN reset), the mandatory-PIN gate, and the logout→PIN change. All returned **GO**.
- **Test gap (known):** no automated **E2E / Storybook interaction** tests — see §5 (0008 task D.2).

## 4. Decisions & deviations from the original ACs

Sprint 1 grew a hardening/cost track (0009, 0010) beyond the original story ACs. The material deviations:

1. **SMS-only OTP; WhatsApp fallback deferred.** ADR-001 named WhatsApp OTP as a fallback; shipped SMS-only via a provider-agnostic seam (Vynfy first). WhatsApp slots behind the same seam later (0009 §8).
2. **Device trust + PIN step-up added (0010).** To stop spending an SMS on every re-auth, OTP became a *device-enrollment* event and a free **PIN step-up** handles routine re-auth. This reshaped two ACs:
   - *Auth US-003 AC4* "expired refresh → new OTP" → **PIN step-up on a trusted device**; full OTP only when untrusted/new.
   - *Auth US-004 logout* → logout now **keeps device trust** (→ PIN next entry, no SMS); `device/forget` ("Not you?") is the full-untrust path (→ OTP).
3. **Mandatory PIN-setup gate.** A session with no PIN is forced to `/pin-setup` before the app (driven by `/auth/me`'s live `pinHash`) — PIN setup is now unmissable, not a skippable tail of onboarding.
4. **PIN hardening.** 6-digit minimum + weak-PIN blocklist + HMAC **pepper** (key outside the DB); per-device self-healing lockout; constant-time decoy on verify.
5. **Session cadence.** Access 15 min; refresh **idle timeout 3 days** + **absolute cap 30 days** (replacing the old pure-sliding 30-day window, which never re-locked).
6. **Multi-org switching deferred from v1** (Multi-tenancy US-001 AC3) — schema supports it; org-switch UI/endpoint parked.
7. **BFF/httpOnly-cookie token architecture** — tokens never touch client JS (env policy: no `NEXT_PUBLIC_`); the `/login` first-screen decision is a server-side resolver.

## 5. Follow-ons surfaced (backlog / pre-release)

**Pre-release checklist (blocks a real deploy, not the code):**
- [ ] **Commit** the 0008/0009/0010 work — the entire body is currently **uncommitted** on `dev`.
- [ ] **Apply the DB migration** for real — `20260718000000_0010_device_trust_pin` is create-only against a drifted local DB; needs `DIRECT_URL` set + a clean `migrate deploy` on a non-drifted DB.
- [ ] **Set secrets per env** — `PIN_PEPPER` (refused in production if unset, by design) and `SMS_DAILY_BUDGET`.
- [ ] **Cutover plan** — feature-flag the refresh idle-timeout rollout with the SMS-budget breaker live first (one-time enrollment-OTP spike expected when existing idle sessions re-enroll).
- [ ] **Fix the 0009 test-env collision** — local `.env` `OTP_DELIVERY_DRIVER="sms"` reddens the older suites' stub helper (two-line fix / point CI at `stub`).

**Engineering backlog (non-blocking):**
- **E2E / interaction test tooling (0008 task D.2)** — Playwright / Storybook play-functions still unbuilt; the auth+PIN UI shipped with visual stories only. Flagged **High risk** and growing with each new screen.
- **Security residuals (from the 0010 reviews):** shared-device logout affordance ("log out of this device completely" → `device/forget`); tidy the now-stale `controller.logout` DT-clear + comment; middleware presence-check vs. `getMe` validation; document that the PIN gate is a UX gate, not an API-authz boundary.
- **0010 §13 open decisions:** PIN scope (per-Account vs per-workspace), absolute-cap 30d vs quarter, PIN length, forgot-PIN throttle, biometric (WebAuthn) unlock.
- **0009 §8 follow-ons:** SMS balance monitoring / low-balance alert, delivery-receipt webhooks, WhatsApp fallback / voice OTP.
- **A BFF-cookie token-architecture ADR** (recommended in 0008, still deferred).
- **Multi-tenancy US-004** (dependency-cruiser module-boundary rule) — parked pending a tech-lead check on whether it duplicates the Platform item of the same name.

## 6. Sprint close

Per the process task: this release-increment doc now exists and is linked from the Sprint 1 tracker; the tracker links back here. The **ClickUp Sprint 1 task ([86capbyce](https://app.clickup.com/t/86capbyce)) should be closed** once the pre-release checklist (§5) is actioned — note that this repo edit updates the **local markdown mirror only**; the ClickUp story/sprint statuses must still be updated there. The underlying story tasks stay in their domain lists at `shipped`.

**Next sprint:** [Sprint 2 — Program Access & Enrollment](../sprints/sprint-2-program-access-enrollment.md).
