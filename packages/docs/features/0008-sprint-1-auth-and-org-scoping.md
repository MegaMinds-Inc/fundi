# 0008 — Sprint 1: Auth Token Pipeline + Org-Scoping Enforcement (implementation plan)

> **Status:** planning · **Sprint:** 1 (Identity, Org & Design System Foundation) ·
> **Owners:** Fullstack (backend + BFF), Design (auth UX), QA (test strategy).
> Combines the solutions-architect implementation plan, the UI/UX design addendum, and the QA test plan.
> Design foundations reconciled against the actual hand-off asset (`Fundi Design System.zip` →
> `ui_kits/auth-flow/`). Delivery channel for OTP is **SMS-first** (stub now, real infra slotted later).

---

## Part A — Architecture & backend (solutions architect)

### A.1 What already exists (do not rebuild)
- **Org-scope engine** — `apps/api/src/prisma/`: AsyncLocalStorage `OrgContext` + a Prisma `$extends`
  query extension that injects `organisationId` on tenant models and **throws
  `MissingOrgContextError`** if none is bound. Unit + DB-integration tested. The enforcement
  mechanism (ADR-008) is done; it just isn't *wired* to real requests yet.
- **Tenant-scoped schema** — every domain table carries `organisation_id`; `Organisation` is the
  tenant root. `TENANT_SCOPED_MODELS` guarded by a completeness test.
- **`AuthFlow` + `OtpInput` UI** — pure state machine with injected `onRequestOtp`/`onVerifyOtp`;
  mobile attributes already present (`inputMode="numeric"`, `autoComplete="one-time-code"`).
- **Env policy (locked)** — no `NEXT_PUBLIC_`; all config server-side; API calls server-to-server.
  This *forces* the BFF architecture below.

### A.2 The identity gap (shapes everything)
There is **no global identity**. `Mentor`/`Learner` are `@@unique([organisationId, phone])` — tenant
rows, not auth principals, and cannot be queried at login because no org context exists yet.
**Decision:** add four **non-tenant-scoped** identity/authz tables. They live *outside* the tenant
boundary precisely because they must be readable *before* org context exists — and therefore must
**not** be added to `TENANT_SCOPED_MODELS` (doing so would deadlock login).

### A.3 Data model additions (`schema.prisma`)
- **`Account`** — global identity, `phone @unique` (E.164), the auth principal.
- **`Membership`** — bridges `Account` → `Organisation` (`role`, optional `mentorId`/`learnerId`);
  readable pre-context; resolves "which orgs, as what, as which row."
- **`OtpChallenge`** — `phone`, `codeHash`, `attempts`, `expiresAt`, `consumedAt`; pre-auth.
- **`RefreshToken`** — `accountId`, `familyId`, `tokenHash @unique`, `app` (creator|learner),
  `expiresAt`, `revokedAt`, `replacedById`; rotation + reuse detection.

Add `accountId` back-relation to `Organisation`; `Membership.role` reuses `MentorRole`. None of
the four go in `TENANT_SCOPED_MODELS`.

### A.4 Token pipeline — BFF with httpOnly cookies (the key architecture)
No-`NEXT_PUBLIC_` means the browser cannot hold the API URL or tokens → a **Backend-for-Frontend**
is the only compliant shape, and it also satisfies US-004 "secure storage only":

```
Browser (thin PWA) ──same-origin──► Next.js BFF routes ──server-to-server (Bearer)──► NestJS API
   ▲ httpOnly cookies only            (creator / learner)         (apps/api)
     no token in JS                   holds tokens, owns refresh
```

- **Cookies (set by BFF):** `__Host-fundi_at` (access JWT) + `__Host-fundi_rt` (refresh) —
  `httpOnly; Secure; SameSite=Lax; Path=/`. JS never touches a token.
- **Per-app logout scoping (US-004):** creator and learner are separate origins → separate cookie
  jars → logout of one cannot touch the other. Free from the architecture.
- **Access** — JWT ~10–15 min; claims `sub`(accountId), `org`, `role`, `app`. `org` is what the API
  binds context from with zero per-request DB lookup.
- **Refresh** — opaque, ~30–60 d, stored hashed with `familyId`; rotated every use; reuse of a
  revoked token revokes the whole family (theft detection).
- **Silent refresh (US-003)** — single-flight in the BFF fetch wrapper: API 401 → `/auth/refresh` →
  rewrite cookies → retry once. **Distinguish `invalid_grant` (→ re-auth) from network/5xx (→ keep
  session, retryable).** Never eject a logged-in user on a flaky connection.

### A.5 Backend `auth` module (`apps/api/src/modules/auth/`)
All endpoints `@Public()` (skip org guard):
- `POST /auth/otp/request {phone}` — `@nestjs/throttler` (per-IP) + per-phone issuance cap via
  `OtpChallenge` count; hash+store code; dispatch via `OtpDeliveryService`; always `204` (no
  account enumeration).
- `POST /auth/otp/verify {phone, code, app}` — validate challenge; find/create `Account`; if
  `app=creator` and no membership → bootstrap org (A.6); mint pair; return pair + memberships.
- `POST /auth/refresh {refreshToken}` — rotate with reuse detection; re-mint (carries `org`).
- `POST /auth/logout {refreshToken}` — revoke token (+ family), scoped by `app`.
- `GET /auth/me` — principal + memberships for UI auth state.

**OTP delivery is stubbed first (confirmed):** `OtpDeliveryService` behind an interface with a
**console/stub driver** for dev/CI; the real SMS driver (WhatsApp fallback later, ADR-001) is
slotted in behind the same seam as separate infra work — not Sprint 1.

**Binding org context per request (completes Multi-tenancy US-002):**
```ts
// AuthGuard: verify __Host-fundi_at → req.principal = {accountId, org, role, app}
// OrgContextInterceptor (global):
intercept(ctx, next) {
  const { org } = ctx.switchToHttp().getRequest().principal;
  return from(runWithOrgContext({ organisationId: org }, () => lastValueFrom(next.handle())));
}
```
`runWithOrgContext` already `await`s `fn()`, so the lazy Prisma query dispatched inside the
interceptor runs while the ALS zone is still active.

### A.6 Org creation on signup (Multi-tenancy US-001)
In `verify`, first-time creator: (1) create `Account` + consume `OtpChallenge` (unscoped);
(2) create `Organisation` → get `org.id`; (3) `runWithOrgContext(org.id, () => tx { create
Mentor(role=owner); create Membership })` — `Mentor` create stamps `organisationId` from context,
never by hand. Org must exist before entering its context to create the Mentor. **Learners are not
self-serve** — a `Learner` row is created by a creator's enrollment (Sprint 2); a learner who
authenticates now lands in a legitimate "no programs yet" state (see B.6).

**Multi-org for creators (US-001 AC3) is deferred pending product** — schema supports it; token
carries a single active `org`; org-switch UI/endpoint out of Sprint 1.

### A.7 Frontend wiring (`apps/creator`, `apps/learner`)
BFF routes (`app/api/auth/{request-otp,verify,logout}/route.ts`, `middleware.ts`) read
`process.env.API_BASE_URL` server-side only. Wire `AuthFlow`'s callbacks to same-origin BFF routes.
Shared DTOs (`AuthTokens`, `Principal`, `MembershipDTO`) live in `@fundi/types`.

### A.8 Build sequence
0. **P0 — fix the `stampData` cross-tenant write hole (D.1) before anything else.** It is the
   foundation everything below writes through.
1. Schema + migration (Account/Membership/OtpChallenge/RefreshToken).
2. Auth guard + OrgContextInterceptor (turns the engine on) — **Multi-tenancy US-002**.
3. OTP request/verify + org bootstrap — **Identity US-001/002 + Multi-tenancy US-001**.
4. Refresh rotation + logout — **Identity US-003/004**.
5. BFF routes + cookies + silent-refresh wrapper; wire `AuthFlow`.
6. First-run onboarding (B.5) + empty states (B.6) + E2E + docs; mark CI checks required.

---

## Part B — Auth UX (senior UI/UX designer)

**Reconciled against the real hand-off** (`ui_kits/auth-flow/`). The mockup is a 3-step
mobile screen (~390px), dark default: `F` tile → "What's your number?" (SMS copy: *"We'll text you a
code — no password to remember"*) + Terms/Privacy microcopy → OTP (6 mono boxes, back-affordance
showing the number, wrong/expired error states with filled icons, `0:30` mono resend countdown) →
success (`check-circle`, "You're in", 1400 ms auto-redirect). These notes *add* to that, keyed to
Part A sections.

### B.1 (→ A.5) Delivery channel = SMS, kept honest
Copy stays SMS ("We'll text you a code"), matching the hand-off and the stub-first decision. **Do
not** introduce WhatsApp channel copy or the WhatsApp-bubble motif on auth yet — defer both to when
the WhatsApp OTP fallback infra is slotted in, then make the OTP-step copy name the actual channel.

### B.2 (→ A.7) Phone field — normalize server-side, don't force `+E.164` on users
The hand-off deliberately uses a **familiar local format** (`080 123 45678`, error `e.g. 0803 123
4567`), not `+233…`. Keep that: accept the local leading-`0` format, **normalize to E.164
server-side** with a default country context. A `PhoneInput` shared module (dial-code context +
local-format entry + normalization) is the right home so Sprint 2 enrollment reuses it — but it must
not regress the friendlier local entry the hand-off chose.

### B.3 (→ A.4) Design the *failure* surface of silent refresh
- Network/transient → non-destructive **offline/retry banner**, session preserved. This banner does
  not exist yet (`OfflineBanner` was deferred) — build it now; auth is its first consumer.
- Genuine expiry → calm re-auth state (*"Please sign in again to continue"*) that **preserves
  return-to context**. Never a raw error or cold-home bounce.

### B.4 (→ A.5) Async latency states (Button has no loading state)
`Button` supports `disabled` but **no `loading`/spinner** (a `Spinner` primitive already exists
unused). Real OTP request/verify are async over flaky networks:
- Add a `loading` variant to `Button` (spinner + disabled + preserved width, honoring the 0.97
  press-scale).
- Lock OTP verify on submit — auto-submit + slow network is a double-submit trap; pairs with the
  pipeline's idempotency (A.4).
- Timeout copy after ~10 s: *"Still sending… check your connection."*
- **Rate-limit UX** (pairs with the throttler in A.5): *"Too many attempts. Try again in 4:59"* with
  a live countdown in JetBrains Mono; after 2 failed resends offer a support path. (Net-new — the
  hand-off has only wrong/expired.)

### B.5 (→ A.6) Creator first-run onboarding — the missing screen (**confirmed: build it**)
`Organisation.name` and `Mentor.name` are required, but the auth mockup ends at success → the org
would be *"Untitled Organisation."* Insert a **first-run onboarding step** after the first creator
verify, before the dashboard: capture **workspace/org name** + creator's **own name**, two fields,
second-person voice (*"What should we call your workspace?"*). New screen, belongs to Multi-tenancy
US-001's experience.

### B.6 (→ A.6) Learner "no programs yet" empty state — corrected framing
Learners do **not** get lessons entirely on WhatsApp — the learner PWA is a real surface for viewing
lesson content and progress (BRD: Learner PWA). Do **not** imply lessons arrive via WhatsApp. Use the
built `EmptyState`: *"You're all set. When your mentor adds you to a program, your lessons and
progress will show up here."* No dead end, no misleading channel claim.

### B.7 (cross-cutting) Accessibility gaps that are auth blockers, not follow-ups
Grep confirms **zero `aria-live`/`role=alert`/`role=status`** anywhere in `packages/ui` — auth errors
are currently silent to screen readers.
- Announce errors (wrong/expired/rate-limit) via `aria-live="assertive"`.
- Focus management on each step transition (phone → OTP → success): move focus to the step heading /
  first field.
- OTP grid: group label + per-box `aria-label` ("digit 1 of 6"); read as one field, not six.
- Success auto-redirect (fixed 1400 ms) is an a11y risk — add a visible **"Continue"** fallback and
  announce success via `role="status"`; don't rely on the timer alone.
- `prefers-reduced-motion`: gate the 120–150 ms transitions and the 0.97 press-scale.
- Touch targets ≥44×44 (mockup OTP boxes are 42 wide — nudge to ≥44).

### B.8 (cross-cutting) Both themes are a design-QA gate
The same `AuthFlow` renders **dark on creator, light on learner**. Verify Pulse-green accent, success
check, error-red, and contrast (WCAG AA) hold in **both** themes — not just the dark default.

### Design-owned todos
| # | Todo | Ties to | Type |
|---|------|---------|------|
| D1 | `PhoneInput` (local-format entry + server-side E.164 normalize) | A.7 / B.2 | New component |
| D2 | `Button` `loading` state (uses existing `Spinner`) | A.5 / B.4 | Enhancement |
| D3 | `OfflineBanner` — build now, auth is first consumer | A.4 / B.3 | New component |
| D4 | `aria-live` error/status pattern across auth | B.7 | a11y |
| D5 | Creator first-run onboarding (name org + self) | A.6 / B.5 | New screen |
| D6 | Learner empty state (corrected, non-WhatsApp framing) | A.6 / B.6 | Screen state |
| D7 | Error/rate-limit copy deck (wrong/expired/throttled/offline/timeout) | A.5 / B.4 | Content design |
| D8 | Both-theme + reduced-motion design-QA pass on login | B.8 | Review gate |

---

## Part C — QA & test strategy (senior QA engineer)

> Grounds every case in the actual stack: NestJS + Prisma `$extends` org-scope engine (`apps/api/src/prisma/`), Next.js BFF with `__Host-` httpOnly cookies, SMS-stub OTP first. Runner is **`node --test` + `ts-node/register`** over `src/**/*.test.ts` (see `apps/api/package.json`) — there is **no jest/vitest**. New suites are plain `*.test.ts` using `node:test` + `node:assert/strict`, matching `org-scope.test.ts`. Nest HTTP tests use `@nestjs/testing` (already a devDep). This part specifies strategy, not test code.

### C.1 Test pyramid — where each concern lives, and what runs in CI vs locally

| Layer | Tooling (existing/idiom) | What it proves | CI? |
|---|---|---|---|
| **Unit (pure)** | `node --test`, no DB — like `org-scope.test.ts` | scoping algebra (`applyOrgScope`/`scopeOperation`), token TTL/claim shaping, phone normalization, OTP hash/attempt math, BFF `invalid_grant`-vs-network branching | Always (fast, no services) |
| **Integration (DB-backed)** | `node --test` + real Postgres, **skip-guarded** like `org-isolation.integration.test.ts` | refresh rotation/reuse on `RefreshToken`, OTP challenge lifecycle, org-bootstrap atomicity, real Prisma extension end-to-end | **Runs for real in CI** (Postgres service in `ci.yml`); auto-skips locally with no `DATABASE_URL` |
| **HTTP contract / binding** | `@nestjs/testing` `Test.createTestingModule` + `app.listen(0)` + `fetch` (or add `supertest` devDep) | guard+interceptor actually bind org context on a real request; cookie flags; 401 on unauth; `@Public()` routes bypass scoping | **CI** (needs DB, same skip idiom) |
| **Frontend component/interaction** | Storybook `play` functions (Storybook already gated via `build-storybook` in `ci.yml`) — *see C.4 gap* | `AuthFlow`/`OtpInput` state machine, autofill spread, double-submit lock, both themes | `build-storybook` gates broken stories; interaction assertions need wiring (C.8 risk) |
| **E2E** | Playwright (**not installed** — C.8) | full browser → BFF → API cookie round-trip, silent refresh, per-app logout | Not yet; add as a separate required job |

**Idiom to preserve:** every new DB-backed suite MUST copy the skip-guard from `org-isolation.integration.test.ts` (probe `SELECT 1` in `before()`, `t.skip()` at runtime — not the synchronous `skip` option) so `pnpm test` stays green on a machine without Docker while running for real in CI. Seed/cleanup must respect FK order as that file already documents.

### C.2 Security-critical test cases (the core)

**C.2.1 Cross-tenant isolation — prove the *wired* path, not just the engine.**
`org-scope.test.ts` and `org-isolation.integration.test.ts` prove the extension in isolation and against Postgres, but both bind context by calling `runWithOrgContext` **by hand**. The untested link is the plan's A.5 `AuthGuard` + global `OrgContextInterceptor`, and whether the ALS zone *survives the rxjs pipeline* (`from(runWithOrgContext(... lastValueFrom(next.handle())))`) across interceptor → controller → service → lazy Prisma `await`. Add an HTTP-level suite (`apps/api/src/modules/auth/org-binding.integration.test.ts`):
- Seed Org A + Org B via the **raw** client (as the integration test does). Hit a real tenant route (e.g. `GET /programs`) with a valid access JWT carrying `org=A`; assert only A's rows, zero B rows — proving the interceptor bound `A` from the token, not a hand-wired context.
- Same route, **no cookie/JWT** → `401`, and assert **no query ran** (loud fail, not empty-200).
- A route that touches a tenant model reached with a valid JWT but through a deliberately mis-registered interceptor (context not bound) → surfaces `MissingOrgContextError` as `500`, never a `200` with unscoped rows. This is the regression proof that the loud-fail reaches the HTTP boundary.

**C.2.2 Refresh rotation + reuse detection (`RefreshToken`: `familyId`, `tokenHash @unique`, `revokedAt`, `replacedById`).** DB-backed:
- Rotate: one `POST /auth/refresh` marks the old row `revokedAt`, sets `replacedById`, mints a new `tokenHash` in the same `familyId`.
- **Reuse → family revocation:** replay an already-rotated (revoked) token → **every** row sharing `familyId` gets `revokedAt`, and any subsequent refresh in that family returns `invalid_grant`. This is theft detection; it is the single most important auth test.
- Expired refresh (`expiresAt` past) → `invalid_grant`, no rotation.
- Cross-app: a `creator` refresh token cannot mint a `learner` pair (assert `app` column enforced).

**C.2.3 OTP abuse (`OtpChallenge`: `codeHash`, `attempts`, `expiresAt`, `consumedAt`).**
- **Attempt cap:** N wrong `verify` calls increment `attempts`; N+1 is rejected even if the code is then correct (locked challenge).
- **Issuance cap / rate limit:** per-phone issuance cap via `OtpChallenge` count, and per-IP `@nestjs/throttler` (**not yet installed** — C.8). Over-cap `POST /auth/otp/request` → `429`.
- **Expiry:** verify after `expiresAt` fails with a resend prompt, not a generic error.
- **Replay:** a consumed challenge (`consumedAt` set) cannot verify twice.
- **No account enumeration:** `POST /auth/otp/request` returns **`204` byte-for-byte identical** for a known vs unknown phone, and in the same latency band (no timing oracle from a DB write on one path only) — assert both response and status parity.

**C.2.4 Token expiry / silent refresh (BFF wrapper).** Unit-test the fetch wrapper against a mocked API:
- API `401` → one `/auth/refresh` → cookies rewritten → single retry → success.
- **`invalid_grant` vs network:** `401 invalid_grant` → clear cookies → re-auth state (B.3). Network error / `5xx` → **keep cookies**, surface retryable `OfflineBanner`; never eject on a flaky connection.
- **Single-flight:** two concurrent `401`s trigger exactly **one** `/auth/refresh` (two tabs / parallel requests — C.5).

**C.2.5 Logout scoping per app (US-004).** `POST /auth/logout` revokes only the calling `app`'s token+family; a token for the other `app` stays valid. Complement with an E2E assertion that creator and learner, being separate origins with separate `__Host-` cookie jars, cannot clear each other's cookies.

**C.2.6 Cookie assertions.** On every BFF response that sets auth cookies, assert `Set-Cookie` for `__Host-fundi_at`/`__Host-fundi_rt` carries `HttpOnly; Secure; SameSite=Lax; Path=/` and **no `Domain`** (the `__Host-` prefix requires exactly this). Negative assertion: the access token never appears in any response body delivered to the browser and is unreachable from `document.cookie` (E2E).

**C.2.7 `MissingOrgContextError` loud-fail is a preserved invariant.** Keep the existing `scopeOperation` throw tests; add the HTTP-boundary proof in C.2.1 so a future refactor of the interceptor/error filter that swallows it into a `200` fails CI.

### C.3 Regression guardrails

- **Completeness test (extend, don't duplicate):** `org-scope.test.ts` → `'TENANT_SCOPED_MODELS stays in sync with the schema'` already fails CI if a new `organisation_id` model is added without registering it in `TENANT_SCOPED_MODELS`. It stays the guard for new tenant tables. **Extend it with the inverse assertion demanded by A.2:** the four new identity tables (`Account`, `Membership`, `OtpChallenge`, `RefreshToken`) must **not** declare `organisation_id` and must **not** be in `TENANT_SCOPED_MODELS` — scoping them would deadlock login (they must be readable *before* org context exists). This is a net-new, load-bearing guardrail; without it a well-meaning "you forgot to scope Account" change bricks auth.
- **Unauthenticated tenant route fails loudly:** the C.2.1 no-cookie `401` case, kept as a standing regression.
- **`@Public()` routes bypass the guard:** the five `/auth/*` endpoints must remain reachable with no context (else login deadlocks). Contract test each.

### C.4 Frontend / mobile-first QA

Target surface is `packages/ui/src/modules/AuthFlow.tsx` + `OtpInput.tsx`.
- **OTP autofill / paste:** `OtpInput.handleChange` fan-out (`fillFrom`) and `handlePaste` spread a full 6-digit code across boxes from box 0; `autoComplete="one-time-code"` only on box 0. Verify iOS SMS-autofill and paste both land all six digits and fire `onComplete` once.
- **Double-submit lock:** `AuthFlow.verify` must not fire twice — `OtpInput` is `disabled={verifying}`, but auto-submit-on-complete + a slow network is the trap B.4 names. Assert a second `onComplete` during an in-flight verify is dropped (pairs with pipeline idempotency A.4).
- **Offline/retry vs expiry:** verify B.3's two surfaces are distinct — transient → non-destructive `OfflineBanner` (D3, session preserved); genuine expiry → calm re-auth preserving return-to context. Same underlying trigger must not collapse into one banner.
- **Both themes (design-QA gate B.8):** identical `AuthFlow` renders **dark on creator, light on learner**. Verify Pulse-green accent, success `check`, error-red, and WCAG-AA contrast in **both** `data-theme` states — one story per theme.
- **A11y (B.7 — auth blockers, verified here):** grep confirms **zero** `aria-live`/`role=alert`/`role=status` in `packages/ui` today, so these are new-code assertions, not audits: (a) errors (wrong/expired/rate-limit) announced via `aria-live="assertive"`; (b) focus moves to the step heading/first field on each phone→otp→success transition; (c) `OtpInput` exposes a group label + per-box `aria-label` (`"Digit i of 6"` already present) and reads as one field; (d) success has a visible **"Continue"** fallback + `role="status"`, not the 1400 ms timer alone (`SUCCESS_REDIRECT_MS`); (e) `prefers-reduced-motion` gates the 120–150 ms transitions and 0.97 press-scale.
- **Touch targets ≥44×44:** `OtpInput` `BOX_STYLE` is already `width:44,height:52` — assert it does not regress below 44, and that `Button` press-scale keeps effective hit area ≥44.

### C.5 Edge cases & negative paths

- **Concurrent refresh from two tabs:** both hit `401`, both call `/auth/refresh` with the *same* current token; exactly one rotation must win and the loser must **not** trip reuse-detection family revocation (a benign race must not look like theft). This is the nastiest interaction between C.2.2 and C.2.4 single-flight — test at both BFF (single-flight) and API (idempotent/tolerant rotation window) layers.
- **OTP replay:** consumed challenge cannot re-verify (C.2.3).
- **Clock skew on expiry:** access-JWT `exp` verification needs a defined leeway; test a token a few seconds past `exp` against the agreed tolerance (plan does not specify one — C.8).
- **Org bootstrap partial failure / atomicity (A.6):** `Account` create (unscoped) + `Organisation` create + `runWithOrgContext(tx { Mentor(owner) + Membership })` are **not one transaction**. Test: failure after `Account`/`Organisation` but before the Mentor/Membership tx must not leave an orphan `Account` with no `Membership` or an `Organisation` with no owner `Mentor`; a re-verify must be idempotent (recover, not duplicate).
- **Phone normalization collisions:** `Account.phone @unique` is E.164, but B.2 accepts local `080…`. `AuthFlow.requestCode` only strips non-digits and validates 9–12 digits — it does **not** normalize. Test a matrix where local `08012345678` and `+233…` forms must resolve to one canonical Account (no split identity), and where a mistyped country context cannot collide two distinct humans onto one Account.

### C.6 Test data / fixtures / environment

- **Two-org isolation seeding:** reuse the exact pattern in `org-isolation.integration.test.ts` — a **raw** (unextended) `PrismaClient` seeds both orgs (the only code allowed to cross tenant boundaries), the **scoped** client is exercised under `runWithOrgContext`/HTTP binding. FK-respecting cleanup order (`Program → Mentor → Organisation`, now extended for `Membership`, `RefreshToken`, `OtpChallenge`, `Account`) in `before`/`after`.
- **OTP stub assertion — needs a test-only peek seam (flagged).** The `OtpDeliveryService` console/stub driver logs the code; asserting on captured stdout is brittle and racy. Recommend a **recording fake** injected via Nest DI (`Test.createTestingModule().overrideProvider(OtpDeliveryService)` with an in-memory driver exposing `lastCodeFor(phone)` / `sent[]`). This keeps the assertion behind the same interface seam A.5 already defines and never touches production console behavior. If a peek is instead built into the stub itself, it must be hard-guarded to non-production (`NODE_ENV !== 'production'`) — call this out as an explicit test-only affordance, not a shipped endpoint.
- **Env:** CI already provides `DATABASE_URL`/`DIRECT_URL` (Postgres 16 service) and runs `prisma migrate deploy`. New migration for the four identity tables must land before these suites, or CI red-flags on missing tables (desired). Auth suites need a signing key — inject a fixed test `JWT_SECRET` via the Nest test module, server-side only (honors the no-`NEXT_PUBLIC_` env policy).

### C.7 Definition of Done / exit criteria per story

Each is "done" only when the named checks are green in CI:

- **Identity US-001 (phone/OTP request):** C.2.3 issuance-cap + `429` + no-enumeration `204`; phone-normalization matrix (C.5); B.7 error announced.
- **Identity US-002 (verify + create/login):** correct OTP creates `Account` if new / logs in if existing; wrong OTP within attempt cap retries then locks; expired prompts resend; replay blocked (C.2.3); org bootstrap atomicity (C.5).
- **Identity US-003 (refresh/access):** pair issued together; silent refresh renews without user action; **reuse → family revocation** (C.2.2); expired refresh forces OTP; `invalid_grant`-vs-network branch (C.2.4); concurrent-tab race (C.5).
- **Identity US-004 (session/logout):** per-app logout scoping (C.2.5); cookie flags + `__Host-` (C.2.6); no `localStorage` token (E2E asserts token absent from JS).
- **Multi-tenancy US-001 (org on signup):** `Organisation` + `organisation_id` created on first creator verify; owner `Mentor` + `Membership` created via context, never hand-stamped; atomicity (C.5). (Multi-org AC3 is deferred — mark N/A for Sprint 1.)
- **Multi-tenancy US-002 (repo-layer scoping):** the **wired** HTTP binding proof (C.2.1) — this is what US-002's "enforced automatically at the query layer" actually requires and is currently unproven end-to-end.
- **Multi-tenancy US-003 (architectural test):** already met by `org-scope.test.ts` + integration test + `ci.yml` gate; DoD here is that the new suites **join the same required check** and the completeness test is extended per C.3. Make the CI job a required check via branch protection (the sprint doc notes this is still pending).

### C.8 Coverage gaps & risks to escalate

1. **[High — cross-tenant write hole] `stampData` lets a caller override the org on create.** In `org-scope.ts`, the create path returns `{ organisationId, ...row }` — the spread means a **caller-supplied `organisationId` wins over context**. The code comment claims "the extension never lets it differ from context — see prisma.service.ts guard," but **no such guard exists** in `prisma.service.ts` (verified). Reads are safe (`scopeWhere` spreads `organisationId` last); creates are not. A service that passes an attacker-influenced `organisationId` in `data` writes into another tenant. **Action:** either flip the spread order for creates, or add the promised guard that throws on any `data.organisationId !== context`, and add a red-then-green test. Do not close US-002 until fixed.
2. **[High] No frontend test tooling.** `packages/ui` runs `node --test` only; there is no jsdom/testing-library and no Playwright anywhere. B.7 a11y (focus/aria-live/reduced-motion), OTP autofill, double-submit lock, and the full BFF cookie E2E **cannot be automatically verified today** — `build-storybook` only catches broken stories. Escalate: add Storybook `play`-function interaction tests + a Playwright E2E job, or accept a documented manual QA checklist for Sprint 1 and file the tooling as debt.
3. **[Med] `@nestjs/throttler` not installed.** Rate-limiting is a security AC (Identity US-001) but the dependency and per-IP config don't exist yet. Can't test what isn't built — define the throttler contract (limits, window, `429` shape) now so C.2.3 has a target.
4. **[Med] BFF apps have no test setup.** Silent-refresh single-flight and the `invalid_grant`-vs-network branch (the trickiest correctness logic in the whole pipeline) live in the Next.js BFF fetch wrapper, and `apps/creator`/`apps/learner` currently have no test harness. Escalate: stand one up, or these ship unverified.
5. **[Med] Org-bootstrap transaction boundary under-specified.** A.6 wraps only step 3 in a tx; steps 1–2 (`Account`, `Organisation`) are outside it. Ask the architect to define the atomicity/idempotency contract before C.5's atomicity test can assert the right thing.
6. **[Med] Phone normalization is unspecified and client doesn't do it.** B.2 says "normalize server-side with a default country context," but no rules, no shared `PhoneInput` (D1) yet, and `AuthFlow` only strips to 9–12 digits. Given `Account.phone @unique` on E.164, ambiguous normalization risks split-identity or collision. Need the canonical algorithm + default country locked to build C.5's matrix.
7. **[Low] JWT clock leeway undefined.** C.5 clock-skew test needs an agreed `exp` tolerance; the plan doesn't state one.
8. **[Low] ALS-through-rxjs fragility.** The A.5 interceptor snippet is correct but subtle (relies on `runWithOrgContext` awaiting `fn()` so the lazy Prisma dispatch stays in the zone). Global-interceptor ordering, or any guard/interceptor that does Prisma work *outside* the zone, silently breaks it. C.2.1 is the guardrail; insist it is a **required** check, not advisory.

---

## Part D — Pre-work & gaps to close (owned tasks from QA C.8)

Translates the QA-escalated risks into tracked tasks. **D.1 is P0 and blocks the sprint;** the rest
are in-sprint enablers with owners.

### D.1 — P0 security fix: `stampData` cross-tenant write hole (blocks Multi-tenancy US-002)
**Bug (confirmed in committed code):** in `apps/api/src/prisma/org-scope.ts`, the create path
returns `{ organisationId, ...data }` — the trailing spread lets a **caller-supplied
`organisationId` override the context**, so a create with `data: { organisationId: <other-tenant> }`
writes into another tenant (reads are safe: `scopeWhere` spreads `organisationId` last). The code
comment claims a guard in `prisma.service.ts` prevents this; **no such guard exists** (verified) — so
it reads as safe and isn't.

**Fix (fail loud, ADR-008-consistent):**
- In `stampData`, stamp context **last** so it always wins, and **throw** if the caller supplied a
  *different* `organisationId` (an attempted cross-tenant write is a bug or an attack, never
  silently honored). Same treatment for the `createMany` array case — throw if **any** row carries a
  conflicting org. A caller passing the *matching* org is allowed (idempotent).
  ```ts
  function stampData(data, organisationId) {
    const stampRow = (row) => {
      if (row?.organisationId != null && row.organisationId !== organisationId) {
        throw new CrossTenantWriteError(row.organisationId, organisationId); // new, sibling of MissingOrgContextError
      }
      return { ...row, organisationId }; // context wins
    };
    return Array.isArray(data) ? data.map(stampRow) : stampRow(data ?? {});
  }
  ```
- Add `CrossTenantWriteError` to `org-context.ts` alongside `MissingOrgContextError`, same loud-fail
  philosophy.
- **Delete the misleading comment** that references a non-existent guard.
- **Tests (red→green):** extend `org-scope.test.ts` — (a) create with a conflicting `organisationId`
  in `data` throws `CrossTenantWriteError`; (b) create with the matching org succeeds and is stamped;
  (c) `createMany` with one bad row throws; (d) a DB-backed case in
  `org-isolation.integration.test.ts` proving Org A's context cannot persist a row into Org B via
  crafted `data`. **Do not close Multi-tenancy US-002 until (a)–(d) are green.**

### D.2 — Frontend/E2E test tooling (C.8 #2)
No jsdom/testing-library/Playwright exists; `build-storybook` only catches broken stories. **Task:**
stand up Storybook `play`-function interaction tests (for B.7 a11y, OTP autofill, double-submit lock,
both-theme) **and** a Playwright E2E job for the browser→BFF→API cookie round-trip + silent refresh +
per-app logout. **Decision needed:** build the tooling this sprint, or accept a documented manual-QA
checklist for Sprint 1 and file tooling as debt. *(Non-blocking to start coding; blocks the C.4/C.7
automated exit criteria.)*

### D.3 — Install & configure `@nestjs/throttler` (C.8 #3)
Rate-limiting is a security AC (Identity US-001) with no home yet. **Task:** add the dep; define the
contract — per-IP + per-phone limits, window, and `429` response shape — so C.2.3 has a target.
Lands with build-sequence step 3.

### D.4 — Phone normalization spec + `PhoneInput` (C.8 #6, ties to D1/B.2)
`Account.phone` is `@unique` on E.164 but the client accepts local `080…` and only strips to 9–12
digits — split-identity/collision risk. **Task:** lock the canonical normalization algorithm + default
country context; implement it **server-side** in verify/request; build the `PhoneInput` shared module
(D1) for friendly local entry. Blocks the C.5 normalization matrix. Must land with step 3.

### D.5 — Org-bootstrap transaction/idempotency contract (C.8 #5)
A.6 wraps only step 3 in a tx; `Account`/`Organisation` creation sits outside it. **Task:** the
architect defines the atomicity + re-verify idempotency contract (recover vs duplicate on partial
failure) so C.5's atomicity test asserts the right invariant. Resolve before step 3.

### D.6 — Lock JWT clock leeway (C.8 #7)
Define the access-token `exp` verification tolerance so C.5's clock-skew test has a target. Small;
lands with step 4.

### D.7 — `OfflineBanner` + `Button` loading + `aria-live` primitives (design D2/D3/D4)
The component gaps the auth UX depends on. Build alongside step 5 so the BFF failure surfaces (B.3),
async latency (B.4), and a11y announcements (B.7) have real components to render.

---

## Open decisions — non-blocking for Sprint 1, revisit later
None of these gate Sprint 1; the sprint proceeds with the defaults noted. Parked for a later pass.
1. **Multi-org for creators in v1?** (US-001 AC3) — *default for Sprint 1:* single membership, no
   org-switch. Schema already supports multi-org, so revisiting later costs no rework. **Non-blocking.**
2. **Multi-tenancy US-004** (dependency-cruiser boundary rule) — already parked in the sprint doc as a
   possible duplicate; out of Sprint 1 scope regardless. **Non-blocking.**
3. **BFF-cookie token architecture ADR** — recommended for the record; the architecture is decided and
   captured here (Part A) in the meantime, so writing the formal ADR can follow. **Non-blocking.**
