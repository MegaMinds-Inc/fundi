export const meta = {
  name: 'impl-0008-auth-org',
  description: 'Implement feature 0008 (Sprint 1 auth pipeline + org-scoping) as a 6-agent team in 3 waves',
  phases: [
    { title: 'Wave1-Foundation', detail: 'Prisma+security fix, shared types, UI components (parallel, disjoint files)' },
    { title: 'Wave2-Feature', detail: 'NestJS auth backend + BFF/screens (parallel)' },
    { title: 'Wave3-Integrate', detail: 'Workspace typecheck/lint/test + fix cross-boundary breaks' },
  ],
}

const PLAN = 'packages/docs/features/0008-sprint-1-auth-and-org-scoping.md'
const REPO = '/home/princeabaidoo/Projects/fundi'

const SHARED_DEFAULTS = `
PRE-DECIDED DEFAULTS (align to these exactly; do NOT invent alternatives — they were chosen to keep the team coherent and avoid native-build/DB stalls):
- No native-dependency crypto. Use node:crypto ONLY. Refresh tokens: 32-byte random, stored as SHA-256 hash. OTP codes: 6 digits, stored as scrypt hash with per-row salt. Do NOT use argon2/bcrypt (native build would stall install).
- JWT via @nestjs/jwt (pure JS). Access token TTL 15m; refresh TTL 30d; clock leeway 30s. Claims: sub(accountId), org(active organisationId or omitted if none yet), role, app.
- OTP: 6 digits, expiry 5min, max 5 verify attempts per challenge, resend cooldown 30s (matches UI), issuance cap 5 per phone per rolling hour, per-IP throttle 10/min on otp/request via @nestjs/throttler.
- Phone: canonical identity is E.164. Default region for parsing local numbers (e.g. '0803...') = 'GH' (+233), exposed as a DEFAULT_PHONE_REGION constant so it is trivially changeable. (FLAG: mockup placeholder used a Nigerian '080' format while the built AuthFlow used +233 Ghana — I chose GH to match the built component + Africa/Accra timezone default; note this as needs-confirm.)
- Onboarding flow: /auth/otp/verify creates the Account and issues a token. For a creator with NO membership yet, respond { needsOnboarding: true } and mint an ORG-LESS access token (no 'org' claim) that may ONLY call /auth/onboarding and /auth/me. POST /auth/onboarding { orgName, name } creates Organisation + owner Mentor + Membership (org bootstrap A.6) and re-issues a token WITH the org claim. (FLAG this flow as a direction taken.)
- Cookies (BFF): names 'fundi_at' / 'fundi_rt'. In production use the '__Host-' prefix + Secure + SameSite=Lax + Path=/ + no Domain. In non-production (http localhost) drop the '__Host-' prefix and Secure so cookies still set. (FLAG the dev-fallback.)
- Every agent: record any judgment call in decisionsMade with needsUserConfirm=true when a product owner might redirect. Proceed with the default; do NOT block.
`

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['agent', 'filesChanged', 'decisionsMade', 'verification', 'followUps'],
  properties: {
    agent: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    decisionsMade: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['decision', 'chose', 'why', 'needsUserConfirm'],
        properties: {
          decision: { type: 'string' },
          chose: { type: 'string' },
          why: { type: 'string' },
          needsUserConfirm: { type: 'boolean' },
        },
      },
    },
    verification: { type: 'string', description: 'commands run and their pass/fail result' },
    followUps: { type: 'array', items: { type: 'string' } },
  },
}

const common = `Working dir: ${REPO}. This is a pnpm turborepo (NestJS api, two Next.js PWAs, packages/ui, packages/types, packages/config). Read the plan first: ${PLAN}. Implement REAL, compiling, idiomatic code that matches the surrounding style — not stubs or TODOs (except where the plan explicitly says stub, e.g. OTP delivery). ${SHARED_DEFAULTS}
STRICT FILE OWNERSHIP: edit ONLY the files/directories assigned to you below. Do NOT run 'pnpm install' unless your task explicitly says you own dependency installation (only the backend agent does) — this avoids a lockfile race with parallel agents. Return the structured result when done.`

phase('Wave1-Foundation')
const wave1 = await parallel([
  () => agent(`${common}

YOU ARE AGENT A — DB FOUNDATION + P0 SECURITY FIX. You own ONLY: apps/api/prisma/** and apps/api/src/prisma/**.

Tasks:
1. Part D.1 (P0 security fix) in apps/api/src/prisma/org-scope.ts: the create path stamps organisationId FIRST then spreads caller data, letting a caller override the tenant. Fix stampData so context wins (spread data first, organisationId last) AND throw a new CrossTenantWriteError if the caller supplied a DIFFERENT organisationId (matching value is allowed). Handle both single create and createMany array. Delete the misleading comment referencing a non-existent guard.
2. Add CrossTenantWriteError to apps/api/src/prisma/org-context.ts as a sibling of MissingOrgContextError (same loud-fail philosophy, clear message citing ADR-008).
3. Extend apps/api/src/prisma/org-scope.test.ts (match its node:test + node:assert/strict style) with red->green cases: (a) create with conflicting organisationId throws CrossTenantWriteError; (b) create with matching org succeeds & is stamped; (c) createMany with one conflicting row throws; (d) create with no organisationId in data gets stamped from context.
4. Add a DB-backed case to apps/api/src/prisma/org-isolation.integration.test.ts (keep its runtime skip-guard idiom) proving Org A context cannot persist a row into Org B via crafted data.
5. Schema: add 4 NON-tenant-scoped models to apps/api/prisma/schema.prisma per plan A.3 — Account(id, phone @unique E.164, createdAt, memberships), Membership(@@id([accountId, organisationId]), role MentorRole, mentorId? @unique, learnerId? @unique, relations to Account+Organisation, createdAt, @@index([accountId])), OtpChallenge(id, phone, codeHash, salt, attempts default 0, expiresAt, consumedAt?, createdAt, @@index([phone, createdAt])), RefreshToken(id, accountId, familyId, tokenHash @unique, app AppClient, expiresAt, revokedAt?, replacedById?, createdAt, @@index([accountId, app])). Add enum AppClient { creator learner }. Add memberships/accounts back-relations to Organisation. Match existing @map snake_case naming conventions. Do NOT add these to TENANT_SCOPED_MODELS.
6. Extend the TENANT_SCOPED_MODELS completeness test (plan C.3): assert the 4 new identity tables are NOT tenant-scoped and carry no organisation_id.
7. Author a migration SQL file by hand under apps/api/prisma/migrations/<timestamp>_auth_identity_tables/migration.sql (there is NO database in this session, so 'prisma migrate' cannot run — hand-write correct Postgres DDL matching the models; it will be validated/applied in CI). Use a fixed timestamp like 20260714000000.
8. Run 'pnpm --filter @fundi/api exec prisma generate' (works offline) so the generated client types exist for the backend agent. Then 'pnpm --filter @fundi/api exec prisma validate'. Run the prisma unit tests: 'cd apps/api && pnpm exec node --test --import ts-node/register src/prisma/org-scope.test.ts' (or match the repo's configured test runner). Report results.`,
    { label: 'A:prisma+security', phase: 'Wave1-Foundation', schema: RESULT_SCHEMA, effort: 'high' }),

  () => agent(`${common}

YOU ARE AGENT B — SHARED TYPES. You own ONLY: packages/types/**.

Read packages/types to learn its export conventions (it already mirrors Prisma enums). Add auth/identity DTOs so api and web cannot drift (plan A.7):
- AppClient union 'creator' | 'learner'.
- AuthTokens { accessToken: string; expiresIn: number } (refresh lives in an httpOnly cookie, not a body type, but include a RefreshResult shape if helpful).
- Principal { accountId: string; org?: string; role: MentorRole-equivalent; app: AppClient }.
- MembershipDTO { organisationId: string; organisationName: string; role: ...; mentorId?: string; learnerId?: string }.
- VerifyOtpResult { tokens?: AuthTokens; needsOnboarding: boolean; memberships: MembershipDTO[] }.
- OtpRequest/OtpVerify/Onboarding request DTOs.
Export them from the package index following existing patterns. Keep role typing consistent with the existing MentorRole mirror if present (owner|admin|mentor). Verify with 'pnpm --filter @fundi/types build' if such a script exists, else 'pnpm --filter @fundi/types exec tsc --noEmit'. Report results.`,
    { label: 'B:types', phase: 'Wave1-Foundation', schema: RESULT_SCHEMA, effort: 'medium' }),

  () => agent(`${common}

YOU ARE AGENT C — DESIGN SYSTEM COMPONENTS (auth UX gaps D2/D3/D4/D1-client + a11y). You own ONLY: packages/ui/src/** (components, modules, stories, index exports) and packages/ui README if needed. Do NOT touch apps/*.

Read packages/ui/src/components/Button.tsx, Spinner (existing), OtpInput.tsx, AuthFlow.tsx, and an existing *.stories.tsx to match style (inline-style + CSS var tokens, plain-TSX, dark-default theme). Tasks:
1. Button: add a 'loading' prop (plan B.4/D7) — renders the existing Spinner, sets disabled, preserves width, keeps the 0.97 press-scale. Add a story.
2. New OfflineBanner component (plan B.3/D3): non-destructive inline banner (icon + message + optional retry action), theme-token styled, role='status' aria-live='polite'. Story with light+dark.
3. New PhoneInput module (plan B.2/D1): composes Input; accepts friendly local entry (e.g. '080 123 4567'), light as-you-type grouping, a leading dial-code/region affordance defaulting to GH (+233); it does light formatting only — canonical E.164 normalization is server-side, so just expose the raw entered value via onChange. Story.
4. AuthFlow + OtpInput a11y (plan B.7/D4): add aria-live='assertive' to the error text; move focus to the step heading/first field on phone->otp->success transitions; ensure OtpInput has a group label and per-box aria-label ('Digit i of N'); add a visible 'Continue' button on the success step as a fallback to the 1400ms auto-redirect and wrap success text in role='status'; gate transitions/press-scale behind prefers-reduced-motion. Keep OTP boxes >=44x44 touch target. Do NOT change AuthFlow's injected-callback contract (onRequestOtp/onVerifyOtp/onSuccess/appName).
5. Export all new components from src/index.ts. Verify: 'pnpm --filter @fundi/ui lint' and 'pnpm --filter @fundi/ui test'. Report results.`,
    { label: 'C:ui-components', phase: 'Wave1-Foundation', schema: RESULT_SCHEMA, effort: 'high' }),
])

log('Wave 1 done: ' + wave1.filter(Boolean).map(r => r.agent).join(', '))

phase('Wave2-Feature')
const wave2 = await parallel([
  () => agent(`${common}

YOU ARE AGENT D — NESTJS AUTH BACKEND (the heaviest slice). You own ONLY: apps/api/src/modules/auth/** (create it), apps/api/src/app.module.ts, apps/api/src/main.ts, and apps/api/package.json. YOU are the SOLE owner of dependency installation — you MAY run 'pnpm install'. Agent A has already added the 4 Prisma models and run 'prisma generate', and Agent B has added DTOs to @fundi/types — consume both.

Add deps to apps/api/package.json and run 'pnpm install' ONCE: @nestjs/jwt, @nestjs/throttler, cookie-parser + @types/cookie-parser, libphonenumber-js. (NO argon2/bcrypt — use node:crypto per defaults.)

Build the auth module per plan A.4/A.5/A.6, using PrismaService.client (org-scoped) and runWithOrgContext from src/prisma:
1. TokenService: mint/verify access JWT (@nestjs/jwt, HS256, secret from process.env.JWT_SECRET server-side only — add a dev default + note it must be set in prod); create/rotate refresh tokens (32-byte random, SHA-256 hash stored in RefreshToken with familyId; rotation sets revokedAt/replacedById; REUSE of a revoked token revokes the whole family — theft detection).
2. OtpService: generate 6-digit code, scrypt-hash with salt into OtpChallenge, expiry 5m, attempt cap 5, issuance cap 5/phone/hour; verify consumes challenge (consumedAt).
3. OtpDeliveryService: interface + a console/stub driver (plan says stub first) AND a test-friendly recording fake seam (in-memory lastCodeFor(phone)) guarded to non-production (plan C.6) so tests can read the code. Real SMS driver is a later slot — leave the interface.
4. PhoneService: normalize local input to E.164 via libphonenumber-js with DEFAULT_PHONE_REGION='GH'.
5. AuthController (@Public where noted): POST /auth/otp/request (throttled + issuance cap, always 204, no enumeration), POST /auth/otp/verify (find/create Account; issue tokens; creator w/o membership -> needsOnboarding + org-less token), POST /auth/onboarding (org bootstrap: create Organisation then runWithOrgContext(org.id, tx { Mentor(owner) + Membership }); re-issue token WITH org), POST /auth/refresh (rotate + reuse detection), POST /auth/logout (revoke token+family, scoped by app), GET /auth/me (principal + memberships).
6. AuthGuard: verify access JWT (Bearer), attach req.principal. Support a @Public() decorator to bypass. Register globally.
7. OrgContextInterceptor (global): for non-public requests, bind org via from(runWithOrgContext({organisationId: principal.org}, () => lastValueFrom(next.handle()))). If a tenant route is hit with an org-less token, the existing engine throws MissingOrgContextError -> map to 401/403 via an exception filter, never a 200.
8. Wire cookie-parser + throttler in main.ts/app.module.ts; register AuthModule.
9. Unit + DB-integration tests (node:test style, skip-guard for DB per repo idiom): token rotation/reuse->family revocation, OTP attempt/issuance caps + expiry + replay + no-enumeration parity, org-bootstrap atomicity/idempotency, and the C.2.1 wired-binding proof (guard+interceptor actually scope a real request; org-less token on a tenant route fails loudly).
Verify: 'pnpm --filter @fundi/api exec tsc --noEmit' MUST pass; run the auth unit tests; 'pnpm --filter @fundi/api lint'. Report results and any type mismatches you had to resolve against @fundi/types.`,
    { label: 'D:auth-backend', phase: 'Wave2-Feature', schema: RESULT_SCHEMA, effort: 'high' }),

  () => agent(`${common}

YOU ARE AGENT E — BFF COOKIE LAYER + APP SCREENS (both PWAs). You own ONLY: apps/creator/** and apps/learner/**. Consume @fundi/ui and @fundi/types. Do NOT run 'pnpm install' (the backend agent owns the lockfile) and do NOT add new deps — use Next built-ins (next/headers cookies(), fetch, route handlers, middleware). Build against the API CONTRACT documented in the plan (A.5 endpoints + the VerifyOtpResult/needsOnboarding shape in the defaults) so you never stall waiting on Agent D.

Enforce the env policy: NO NEXT_PUBLIC_. Read process.env.API_BASE_URL only server-side (route handlers / server components). 

For EACH app (creator and learner — share a small internal helper module, but keep them per-app since they're separate origins):
1. BFF route handlers under app/api/auth/: request-otp, verify, onboarding (creator only meaningfully), logout — they call the NestJS API server-to-server, and on token issuance set httpOnly cookies 'fundi_at'/'fundi_rt' ('__Host-' prefix + Secure only when NODE_ENV==='production', else plain name + no Secure so localhost http works). SameSite=Lax, Path=/.
2. A server-side fetch wrapper implementing SINGLE-FLIGHT silent refresh (plan A.4/C.2.4): on API 401 -> call refresh once -> rewrite cookies -> retry once; distinguish invalid_grant (clear cookies, signal re-auth) from network/5xx (keep session, surface retryable). Guard against concurrent double-refresh.
3. Login screen app/login/page.tsx mounting @fundi/ui AuthFlow, wiring onRequestOtp/onVerifyOtp to the BFF routes and onSuccess to post-login navigation. appName: creator='your Creator dashboard', learner='your Learner home'.
4. Creator ONLY: first-run onboarding screen (plan B.5/D5) capturing workspace/org name + creator's own name, POSTing to the onboarding BFF route; route the user here when verify returns needsOnboarding.
5. Learner ONLY: 'no programs yet' empty state (plan B.6/D6) using @fundi/ui EmptyState with the CORRECTED framing (do NOT claim lessons arrive via WhatsApp): e.g. 'You're all set. When your mentor adds you to a program, your lessons and progress will show up here.'
6. Use OfflineBanner (from @fundi/ui) for the network-error refresh surface.
Verify: 'pnpm --filter @fundi/creator exec tsc --noEmit' and 'pnpm --filter @fundi/learner exec tsc --noEmit' MUST pass; 'pnpm --filter @fundi/creator lint' and learner lint. Report results.`,
    { label: 'E:bff+screens', phase: 'Wave2-Feature', schema: RESULT_SCHEMA, effort: 'high' }),
])

log('Wave 2 done: ' + wave2.filter(Boolean).map(r => r.agent).join(', '))

phase('Wave3-Integrate')
const wave3 = await agent(`${common}

YOU ARE AGENT V — INTEGRATION & VERIFICATION LEAD. Waves 1 & 2 implemented the feature across prisma, @fundi/types, @fundi/ui, apps/api, apps/creator, apps/learner. Your job: make the WHOLE workspace compile, lint, and pass unit tests, and FIX any cross-boundary breaks (type drift between @fundi/types and its consumers, missing exports, wiring gaps, import errors). You MAY edit ANY file to resolve integration issues, but do not remove functionality the wave agents added.

Do, in order, and iterate until green (or until clearly blocked — then report precisely what's blocked and why):
1. 'pnpm --filter @fundi/api exec prisma generate' (ensure client is current).
2. Typecheck everything: api, creator, learner, ui, types (tsc --noEmit per package). Fix errors.
3. Lint: 'pnpm -w lint' or per-package lint (match repo). Fix violations (respect the no-NEXT_PUBLIC_ ESLint rule and module-boundary rules).
4. Unit tests: run the api + ui + prisma test suites (node --test; DB-backed suites will self-skip with no DATABASE_URL — that's expected and fine). Fix failing UNIT tests.
5. If a workspace-wide build is fast, run 'pnpm -w build' or turbo build for the changed packages; fix build breaks. If 'build-storybook' is quick, sanity-check it, else skip.
Report a precise verification summary: exact commands + pass/fail for each package, what you fixed, and anything still red with the reason. Also aggregate a DECISIONS list: collect every decisionsMade item (esp. needsUserConfirm=true) surfaced by the wave agents that you can infer from the code, so the lead can report them to the user.`,
  { label: 'V:integrate+verify', phase: 'Wave3-Integrate', schema: RESULT_SCHEMA, effort: 'high' })

return {
  wave1: wave1.filter(Boolean),
  wave2: wave2.filter(Boolean),
  wave3,
}