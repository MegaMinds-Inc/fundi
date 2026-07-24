# 0010 — Device trust + PIN step-up re-auth: SMS only for enrollment (plan)

> **Status:** planning (plan-only — no code yet) · **Rev 2 — hardened after engineering review** (backend/tech-lead,
> app-security, frontend). · **Follows:** [0008](0008-sprint-1-auth-and-org-scoping.md) (auth pipeline), [0009](0009-otp-sms-delivery-vynfy.md) (real SMS delivery) ·
> **Owners:** Backend (token model + PIN credential + step-up gate), App-Sec (PIN/device-cookie hardening, pepper),
> Frontend (server-side login resolver + PinInput), Product/UX (copy, step-up moments), Ops (SMS budget breaker).
> **Goal:** stop spending an SMS credit on **every** authentication. Reclassify OTP as a **device-enrollment**
> event (rare, paid) and introduce a **free PIN step-up** for periodic re-auth, so an engaged user
> authenticates by silent refresh most of the time, by PIN occasionally, and by SMS-OTP almost never — **without
> weakening the current security posture.**

> **What changed in Rev 2 (from engineering review):** PIN raised to **min 6 digits + blocklist + server-side
> pepper**; trusted-device cookie is a **random secret hash-stored + rotated** (not "signed"); `pin/set` **cannot
> replace** a PIN on session auth alone; refresh-reuse/theft now **also revokes device trust**; only the *expiry*
> branch of refresh splits into the new codes (reuse/race stay `invalid_grant`); the first-screen decision moves to
> a **server-side `/login` resolver** (AuthFlow stays a dumb prop-driven machine); token model simplified to **one
> new column, no `RefreshFamily` table, no `lastUsedAt`**; added **§8 Rollout/backfill** (the cutover SMS spike) and
> **§11 Testing**; added a **global SMS-budget circuit-breaker** and **SameSite/CSRF** requirements.

---

## 1. Where we are today

- **Access token: 15 min** (`ACCESS_TOKEN_TTL_SECONDS`, `auth.constants.ts:20`) — short, silently refreshable. Good; unchanged.
- **Refresh token: 30 days, rotating, *sliding*** (`REFRESH_TOKEN_TTL_SECONDS`, `auth.constants.ts:50`). Every rotation
  resets `expiresAt` to `now + 30d` (`token.service.ts:147`). Reuse-detection + family revocation are solid
  (`token.service.ts:128-140`); the concurrent-tab race loser is correctly distinguished from theft
  (`token.service.ts:153-159`). Logout revokes by token via `revokeByToken` (`token.service.ts:185`).
- **OTP is effectively per-login.** `AuthService.verifyOtp` (`auth.service.ts:43`) is the *only* way to mint a
  session, always running `OtpService.request` → `delivery.send()` → **one SMS credit** (0009 §2, Vynfy deducts 1/`send`).
- **No device concept, no PIN.** Nothing distinguishes a browser that proved phone ownership last week from a
  brand-new one; nothing lets a user re-authenticate without a fresh OTP.
- **⚠️ Proactive refresh is dormant.** Middleware is **presence-only** on the access cookie
  (`apps/creator/middleware.ts:11`, `req.cookies.has(AT_COOKIE)`) — it never verifies the JWT and never refreshes.
  `/auth/refresh` is called **only reactively inside `authFetch` on a downstream 401** (`bff.ts:202-234`), and the
  only caller is the onboarding route. So **any user idle > 15 min already loses the access cookie, gets redirected
  to `/login`, and falls to full phone+OTP — even though a valid 30-day refresh cookie is sitting right there.**
  This is a live cost leak today, and 0010 cannot deliver its saving until proactive refresh is actually wired (§6, §12.1).

**Three problems fall out:**

1. **Cost.** Every returning-user login = 1 SMS; today, thanks to the dormant refresh above, even a >15-min gap
   costs one. A daily-active mentor burns ~30 credits/month just to open their dashboard.
2. **Sessions never re-lock.** Sliding refresh with no absolute cap renews forever — never re-proving a human is present.
3. **Refresh is wired but unused on navigation** — the machinery from 0008 exists but nothing runs it proactively.

---

## 2. Key decision — device-enrollment OTP + free PIN step-up  ⭐

Split "authentication" into two proofs previously collapsed into one costly SMS:

| Proof | Question it answers | Cost | Frequency |
|---|---|---|---|
| **OTP (SMS)** | *Do you own this phone / enroll this device?* | 1 credit | **rare** — new device, revocation, logout, PIN reset, **sensitive action step-up** |
| **PIN** | *Are you the human, right now, on this already-trusted device?* | **free** | periodic — after idle, or at the absolute cap |
| **Silent refresh** | *(implicit)* is the session still live? | free | continuous, invisible |

**Decision:** device-trust + PIN step-up, **SMS reserved for enrollment + sensitive-action step-up**, staying on
SMS as the OTP channel (WhatsApp deferred — §10). The PIN is the workhorse re-auth because it is free to verify.

**Honest posture note (accepted residual risk).** Today every session-mint requires live phone possession. After
this, phone possession is proven once per device per enrollment lifetime; ordinary re-auth is `device-cookie + PIN`,
both of which live in — and are stolen together from — a single compromised browser, where they collapse to one
factor. This is a real *reduction* for ordinary access, defensible for a low-value, read-heavy mentoring app **only
because** (a) the PIN is hardened (§7), (b) theft detection revokes device trust (§7), and (c) **sensitive/irreversible
actions still force a fresh OTP step-up now** (§7) — not "later when money-movement appears." If Fundi ever holds real
value on the creator side, revisit per-workspace PINs and always-OTP for that surface.

### Rejected / deferred alternatives

- **Full alphanumeric password** — rejected in favour of a **6-digit PIN** (see §7 for why 6, not 4). Faster to
  enter, matches the OTP mental model, reuses the scrypt+salt path (`otp.service.ts:150`).
- **Longer-lived access token (e.g. 3 days)** — rejected. A multi-day access token is a multi-day, non-revocable
  bearer credential. Keep access at 15 min. "3 days" / "1 month" are **re-auth cadences (§3), not token lifetimes.**
- **WhatsApp-primary delivery (ADR-001)** — deferred by product ("stick to SMS for now"). Device-trust + PIN removes
  the *volume*; WhatsApp would later cut the *per-send* cost of the enrollment SMS that remain.

---

## 3. The four clocks

The intent — *"active within 3 days → no prompt; idle 3+ days → PIN; a month old → PIN even if active; new device
→ OTP"* — maps onto four independent clocks. Only the last one costs money.

| Clock | Gates | Recommended value | Mechanism |
|---|---|---|---|
| **Access TTL** | silent API calls | **15 min** (unchanged) | JWT `expiresIn`; silently refreshed |
| **Idle re-auth** | *"you've been away — enter your PIN"* | **3 days** | reject refresh when `now − presentedToken.createdAt > 3d` |
| **Absolute cap** | *"this session is old — enter your PIN regardless"* | **30 days** | reject refresh when `now > familyExpiresAt` (anchored at family birth, never extended) |
| **Device enrollment** | *"unknown device — SMS-OTP"* | until revoked / logout | trusted-device credential — **the only SMS spend** |

- **Idle needs no new column.** Each rotation mints a fresh `RefreshToken` row (`token.service.ts:160`) and the
  client only calls `/auth/refresh` when the 15-min access token lapses, so **the presented token's `createdAt`
  *is* the last-activity timestamp**. Idle = `now − createdAt > IDLE`. (No `lastUsedAt` — dropped as redundant; zero backfill.)
- **Absolute cap = one immutable column, `familyExpiresAt`,** carried forward *unchanged* on every rotation (copied
  in the `tx.refreshToken.create` at `token.service.ts:160`). **No `RefreshFamily` table** — it would add a
  write+read+FK to the hot refresh path for a value that never changes after birth. `row.createdAt` is *last-rotation*
  time, not family birth, so the anchor must be its own field. Implementation risk: if the anchor is ever recomputed
  as `now + TTL` on rotation, the old sliding behaviour silently returns and the cap never trips — covered by a test (§11).
- **Enrollment = long-lived, until revoked.** Losing/replacing a device, clearing cookies, explicit logout, a PIN
  reset, or **refresh-reuse/theft detection** all force a fresh OTP — nothing else does.

> One line: **refresh silently until idle-3d (`createdAt`) or cap-30d (`familyExpiresAt`) trips → PIN (free) → fresh
> family → keep going; device stays enrolled until revoked → only then OTP (paid).**

---

## 4. Flow walkthroughs

1. **First signup (new phone / new device).** phone → **OTP (1 SMS)** → account upsert (`auth.service.ts:47`) →
   creator onboarding as today → **PIN setup on the onboarding/dashboard route** (not blocking first entry; note the
   placement — §12.5). Device enrolled. *Cost: 1 SMS, once.*
2. **Returning, active within 3 days, same device.** Proactive silent refresh (§6) on load → straight in. *Cost: 0.*
3. **Returning after 3+ days idle, same trusted device.** `/auth/refresh` → `reauth_required` → **PIN** →
   **old family revoked, fresh family minted** → in. *Cost: 0.*
4. **Session reaches 30 days old (even if active).** `/auth/refresh` → `session_expired` → **PIN** → fresh family
   (cap clock restarts). *Cost: 0.*
5. **New / unknown device (or cookies cleared).** No trusted-device cookie → **OTP (1 SMS)** → re-enroll → PIN already
   set, no re-setup. *Cost: 1 SMS.*
6. **Forgot PIN.** From PIN entry → **server-driven** OTP send (the BFF resolves the account phone from the
   trusted-device/refresh context — the client has no phone number on this path) → **OTP (1 SMS)** → **PIN reset**
   (`pin-setup`) → reset `pinAttempts`/lockout. Hard rate-limited (§7). *Cost: 1 SMS.*
7. **PIN lockout.** After the attempt cap → **route to the reset flow (OTP → PIN reset)**, not a bare OTP-then-in
   (an OTP alone re-enrolls the device but leaves the user still not knowing their PIN). Lockout is a *timed,
   self-healing backoff* per device (§7) — a burst of bad guesses does not automatically cost an SMS.
8. **Explicit logout.** Revokes the refresh family (`revokeByToken`, `token.service.ts:185`) **and** the
   `TrustedDevice` row → next entry is a full OTP.
9. **Refresh-reuse / theft detected.** The `revokedAt`-branch (`token.service.ts:135`) burns the family **and** the
   associated `TrustedDevice` row → attacker (and the legit user) must re-enroll via OTP. (The benign concurrent-tab
   race, `token.service.ts:157`, does **not** touch device trust.)
10. **Sensitive action** (phone change, disable other devices, data export, any future payout). Always requires a
    **fresh OTP step-up**, regardless of PIN/device state.

---

## 5. Data-model & token changes (sketch — no migration written yet)

- **PIN credential (on `Account`).** `pinHash`, `pinSalt` (scrypt + per-row salt, mirroring `otp.service.ts:150`),
  plus **a server-side pepper** (§7) HMAC'd over the scrypt output, key held in env/KMS *outside the DB*. Per-`Account`
  (shared creator+learner — §12.1). Nullable for existing accounts → null `pinHash` ⇒ `needsPinSetup`.
- **PIN lockout — per device, not per account.** Track attempts/backoff on the **`TrustedDevice`** row
  (`pinAttempts`, `pinLockedUntil`), so one abused device can't lock the whole identity or auto-force an SMS (§7).
- **Refresh absolute cap — one column.** `familyExpiresAt` on `RefreshToken`, immutable across rotation (§3). Nullable;
  backfill live rows to `createdAt + 30d`; code treats null as that fallback, then tighten.
- **Trusted-device credential.** A **high-entropy random secret (≥32 bytes)** in a `__Host-`-prefixed, httpOnly,
  `Secure`, `SameSite=Strict` cookie; **only its SHA-256 is stored** server-side (exactly the refresh-token
  construction, `token.service.ts:104,201-203`) on a `TrustedDevice` row (`accountId`, `app`, `tokenHash`,
  `createdAt`, `revokedAt`, `pinAttempts`, `pinLockedUntil`). **Not "signed", not a fingerprint** — a signature over a
  low-entropy/derivable value is still a bearer token; a fingerprint is spoofable. The secret is **rotated on every
  successful step-up** (same reuse-detection benefit as refresh). Presence + hash-match = "skip OTP, PIN is enough."
  Distinct from the refresh cookie so device trust can outlive a session — but revoked *together* on theft/logout (§4.8–4.9).

---

## 6. Auth surface + BFF changes

New outcomes are expressed via response `code`s the frontend branches on (0008 §B).

**API (`apps/api`):**
- `POST /auth/otp/verify` — on success, mint the **trusted-device** cookie (secret + hash row); response carries
  `needsPinSetup`. Sets device trust for the token's `app`.
- `POST /auth/pin/set` *(new)* — **first-time set only under session auth** (no existing `pinHash`). **Replacing an
  existing PIN requires a fresh proof** — the current PIN *or* a fresh OTP challenge id — **never a bare access
  token.** A successful change also revokes other refresh families (compromise hygiene). CSRF-protected (§7).
- `POST /auth/pin/verify` *(new)* — step-up. **Requires a valid trusted-device cookie** (an anonymous caller learns
  nothing and can't count against limits). Derives `app` + `accountId` from the `TrustedDevice` row (so a learner
  device can never mint a creator token). Per-IP throttle (`OTP_REQUEST_THROTTLE_*`) + per-device lockout;
  **constant-time decoy hashing + a single uniform error** on any miss (no account/PIN existence oracle). On success:
  revoke the lapsed family, rotate the device secret, mint a fresh token pair — **no SMS**.
- `POST /auth/pin/forgot` *(new, server-driven)* — resolves the account phone from the trusted-device/refresh context
  and sends an OTP for reset; the client never supplies a phone here. Rate-limited + subject to the global SMS budget
  breaker (§7).
- `POST /auth/device/forget` *(new)* — clears the current `TrustedDevice` row (backs the UI "Not you?" action; JS
  cannot delete an httpOnly cookie, so this must be a real server call).
- `POST /auth/refresh` — **only the expiry branch** (`token.service.ts:141`) splits: `reauth_required` (idle,
  `now − createdAt > IDLE`) vs `session_expired` (absolute, `now > familyExpiresAt`). **Reuse/theft
  (`token.service.ts:135`) and the concurrent-race loser (`token.service.ts:157`) keep returning `invalid_grant`** —
  the race loser must silently retry (not go to PIN), the theft victim must be forced to OTP (not PIN).
- **Unchanged:** `otp/request`, onboarding, `me`. **Logout** extended to also revoke the `TrustedDevice` row.

**BFF (`apps/creator` + `apps/learner`, byte-for-byte copies — every route is ×2):**
- **New `/login` server resolver** (the router — §12.1). A server component/route that reads the httpOnly RT +
  device cookies *before the UI paints*, calls the API refresh path (reusing `refreshOnce`, `bff.ts`), and branches:
  refresh-OK → `setAuthCookies` + `redirect('/')`; `reauth_required`/`session_expired` **with** a valid device cookie
  → render AuthFlow `initialStep="pin-entry"` (+ server-resolved `displayName`); else → `initialStep="phone"`.
- **Wire proactive refresh** — middleware must stop being presence-only (§1); refresh on navigation when the AT is
  missing but a valid RT exists, so idle-but-valid users never fall to OTP.
- New BFF proxy routes for `pin/set`, `pin/verify`, `pin/forgot`, `device/forget` (none exist today).

---

## 7. Security (mandatory — these are must-fix, not "considerations")

Ordered by the review's severity. Shipping without these is a **net weakening** of today's posture.

1. **`pin/set` cannot replace a PIN on session auth alone** *(was: silent-ATO via stolen session).* First-time set
   only when `pinHash` is null; any *replace* requires the old PIN or a fresh OTP. A PIN change revokes other refresh families.
2. **Device cookie = 32-byte random secret, SHA-256 at rest, rotated on step-up** *(was: forgeable "signed"
   bearer).* No signature-over-payload, no fingerprint-as-identity. Because this cookie alone decides whether OTP is
   required, a copyable/forgeable one is a remote deviceless downgrade — the secret+hash+rotation construction closes it.
3. **PIN entropy: min 6 digits + real blocklist + server pepper** *(was: 4-digit, ~10–20% guess rate).* 4-digit PINs
   are radically non-uniform (top ~20 cover ~27% of choices), so 5 tries ≠ 5/10000. Require **≥6 digits**; a
   **comprehensive weak-PIN blocklist** (hundreds of common PINs, all repeats, ascending/descending runs, `19xx`/date
   patterns) mirrored server-side; and an **HMAC pepper** (KMS/env key *outside* the DB) over the scrypt output so a
   DB-only leak yields nothing crackable offline (per-row salt alone does not stop a targeted 10k enumeration).
4. **Refresh reuse/theft detection also revokes device trust.** Otherwise a detected theft accomplishes nothing —
   the attacker still holds cookie+PIN and PINs back in. The `revokedAt`-branch revokes the `TrustedDevice` row; the
   benign concurrent-race branch does not.
5. **`pin/verify` is hardened as an unauthenticated brute-force surface.** Gate behind a valid device cookie;
   per-IP throttle + **per-device** self-healing lockout (escalating backoff, clears itself; forced-OTP only after
   sustained abuse — so a 5-guess burst never auto-costs an SMS); **constant-time decoy scrypt** + uniform error on
   every not-found/no-credential path (also retrofit the decoy into `otp.service.ts:106-110`, which today returns
   early with no hash — a timing oracle).
6. **CSRF / SameSite explicit.** `__Host-` gives origin isolation, **not** CSRF protection, and no `SameSite` is set
   anywhere today (`auth.constants.ts:190-199`). Set **`SameSite=Strict`** (Lax only where top-level nav needs it) on
   all auth cookies; add a CSRF token / double-submit on `pin/set` and the cookie-authed POSTs; reject cross-site
   `Sec-Fetch-Site` on auth POSTs.
7. **Global SMS-budget circuit-breaker** *(protects the very balance this feature exists to save).* Per-phone caps
   (`OTP_ISSUANCE_CAP=5`/h) bound one victim but not the balance — an attacker with N numbers, or rotating IPs past
   the 10/min/IP throttle, drains it (SMS pumping). Add an org-wide daily send ceiling that **fails closed + alerts**,
   covering enrollment *and* forgot-PIN sends. Prefer reaching forgot-PIN only from the trusted-device context so it
   isn't an anonymous faucet.
8. **Sensitive actions force a fresh OTP step-up now** (§2, §4.10) — not deferred.
9. **Enumeration safety preserved.** `otp/request` stays always-`204`; we never skip sends by account existence.
   `pin/verify`/`pin/forgot` must not leak existence via distinct responses or timing (items 5).

---

## 8. Rollout, migration & backfill (was missing — required before build)

The schema changes are additive and safe, but the *behaviour* is retroactive, so cutover needs care:

- **The cutover is a one-time SMS *spike*, not an instant saving.** On deploy nobody has a `TrustedDevice` row or a
  PIN, so enforcing the 3-day idle timeout bounces every currently-idle user (idle 3–30d) to **OTP enrollment** on
  their next visit. Plan for and fund that spike; it is transient and expected.
- **Feature-flag the idle-timeout enforcement** and roll it forward deliberately (cohort/percentage), with the
  **global SMS-budget breaker (§7.7) live first** as the backstop, and a defined **rollback trigger** (e.g. breaker
  trips, or enrollment-OTP rate exceeds threshold X for Y minutes).
- **Backfill:** `familyExpiresAt = createdAt + 30d` for live refresh rows (null-tolerant in code first, then tighten);
  PIN fields null on existing accounts → `needsPinSetup` on next OTP; `TrustedDevice` starts empty.
- **Row reaper.** Idle-timeout multiplies short-lived, never-revoked, never-pruned `refresh_tokens` rows (idle-lapsed
  families are never revoked, only lapsed). Add a TTL/cleanup job — this also relieves an existing unbounded-growth smell.
- **Logout-all / multi-device.** Design now even if built later: revoke **all** refresh families **and** all
  `TrustedDevice` rows for the account (the row already supports per-device revocation).

---

## 9. Config / constants (server-side only — per env policy, never `NEXT_PUBLIC`)

New knobs alongside the existing OTP/token constants in `auth.constants.ts`, resolved at DI time (same pattern as the
existing TTLs, so tests inject fixtures):

```bash
REFRESH_IDLE_TIMEOUT_SECONDS   = 3 * 24 * 60 * 60      # idle → PIN (measured off token createdAt)
REFRESH_ABSOLUTE_TTL_SECONDS   = 30 * 24 * 60 * 60     # absolute cap → PIN (the "month"); anchors familyExpiresAt
PIN_LENGTH_MIN                 = 6                      # min 6 (see §7.3); 4 only behind a real blocklist
PIN_MAX_ATTEMPTS               = 5                      # per DEVICE; then timed self-healing backoff
PIN_LOCKOUT_BACKOFF_SECONDS    = 30, 120, 600 …         # escalating, self-clearing; forced-OTP only on sustained abuse
PIN_PEPPER                     =                        # secret — HMAC key over the scrypt output, KMS/env, NOT in DB
TRUSTED_DEVICE_TTL_SECONDS     = 180 * 24 * 60 * 60     # enrollment lifetime
SMS_DAILY_BUDGET               =                        # global circuit-breaker ceiling (§7.7); fail-closed + alert
AUTH_COOKIE_SAMESITE           = strict                 # explicit; was unset (§7.6)
```

`ACCESS_TOKEN_TTL_SECONDS` stays **15 min**. `REFRESH_TOKEN_TTL_SECONDS` becomes the per-row idle deadline (bounded
by `familyExpiresAt`); pick one authoritative field per check (idle off `createdAt`, cap off `familyExpiresAt`) — do
not run two overlapping mechanisms (§3).

---

## 10. Cost impact

- **Before:** ≈ 1 SMS × (every login; today even a >15-min gap, per §1's dormant refresh). Grows with *engagement*.
- **After:** ≈ 1 SMS × (new device + forgot-PIN + sensitive-action step-up). Grows with *new devices*, not usage.
- Daily-active user over 30 days: **~30 SMS → ~1** (enrollment), plus rare forgot-PIN. ≈ **90%+ reduction** for
  engaged users, with a *stronger re-lock* posture — **after** a one-time cutover spike (§8), not on day one.
- WhatsApp (0009 ADR-001) remains a second, independent lever to cut the per-send cost of the enrollment SMS that remain.

---

## 11. Testing strategy (required — not optional)

- **Token model:** rotation still passes the concurrent-race guard (`token.service.ts:153-159`) under the new checks;
  **idle vs absolute vs reuse vs race each map to the correct code** (`reauth_required`/`session_expired`/`invalid_grant`);
  repeated rotation past the cap **kills the family** (guards the sliding-regression risk, §3).
- **Step-up:** stolen device cookie **cannot** bypass PIN; PIN-verify derives `app` from the device row (learner
  device can't mint a creator token); PIN lockout is per-device and self-heals; forced-OTP only on sustained abuse.
- **Enumeration/timing:** `pin/verify` + `pin/forgot` give uniform responses and constant-time latency for
  account-exists / PIN-exists / wrong-PIN (decoy hashing).
- **`pin/set`:** first-set under session auth OK; **replace rejected** without old-PIN/OTP proof.
- **Reset:** forgot-PIN resets attempts/lockout; lockout routes to reset, not OTP-then-in.
- **Frontend:** both-theme visual stories for `pin-entry`/`pin-setup` are realistic today (the `theme` toolbar global
  exists). **Automated interaction (play-function) tests are NOT** — there are zero play functions in the repo and no
  `@storybook/test`/runner installed (only `@storybook/addon-docs`); this is 0008's unresolved risk **C.8-#2 / open
  task D.2**. Either **this feature stands up D.2 first**, or it ships both-theme visual stories + a **manual QA
  checklist** and says so — do not assume the tooling exists.

---

## 12. UX — the login / signup screen (state machine + screen specs)

> Target surface: `packages/ui/src/modules/AuthFlow.tsx` (+ `OtpInput.tsx`, `PhoneInput.tsx`), rendered identically
> by `apps/creator` (dark) and `apps/learner` (light). **AuthFlow stays a dumb, prop-driven state machine — the
> *router* is the server (§12.1), not AuthFlow.**

### 12.1 The first-screen decision lives in a server-side `/login` resolver, not AuthFlow

The browser **cannot read** the httpOnly refresh/device cookies, so AuthFlow can't decide which screen to show, and
`useState('phone')` (`AuthFlow.tsx:78`) paints the phone screen first — a client-side probe guarantees a
**flash-of-phone-screen** that then snaps to PIN. Unacceptable at this design bar.

- The **"session live → straight in"** case is already handled by middleware (has-AT → redirect off `/login`); once
  proactive refresh is wired (§6), an idle-but-valid user is refreshed there and **never mounts AuthFlow**.
- The **`/login` route becomes a server resolver** that runs *before paint*: reads RT + device cookies, calls the API
  refresh path, and passes a resolved `initialStep` (+ server-computed `displayName`) into AuthFlow as props. AuthFlow
  only ever disambiguates the two *no-session* cases via that prop.
- `Step` grows to `'phone' | 'otp' | 'pin-setup' | 'pin-entry' | 'success'`; `AuthFlow` gains `initialStep`,
  `onSetPin`, `onVerifyPin`, `onForgotPin`, `onForgetDevice`, `displayName`. (`initialStep` is also what lets
  Storybook render the OTP/PIN screens in isolation — add it partly for testability.)
- **This is ×2 apps** (creator/learner `/login` + `bff.ts` are copies) and needs **net-new BFF routes**
  (`session`/`pin/*`/`device/forget`) that do not exist today.

### 12.2 Phone entry — *enrollment* (existing screen, copy nudge only)

Unchanged mechanically (`AuthFlow.tsx:250`). Keep the neutral **"Sign in"** heading so signup and login stay
indistinguishable (the `upsert`). Sub-copy tweak for the new-device case: *"Enter your phone number — we'll send a
one-time code to set up this device."*

### 12.3 OTP entry — *device-trust proof* (existing screen, near-unchanged)

Keep as-is (`AuthFlow.tsx:198`): 6-box `OtpInput`, `one-time-code` autofill, paste-spread, resend cooldown, double-
submit lock, `aria-live` errors (0008 §B.7/C.8). On success the server sets device trust + `needsPinSetup`. **Note:**
on the forgot-PIN/reset path this screen has **no client-held phone** — the send is server-driven (§12.5), so the
"We sent a code to `{phone}`" copy (`AuthFlow.tsx:206`) and `resend()` (`:143`) must switch to a server-resolved/
masked number, and the "Change number" escape (`:234`) is suppressed in reset mode.

### 12.4 PIN entry — *step-up re-auth* (NEW, the returning-user screen)

The screen most returning users see. **No SMS affordances at all** — that absence signals the path is free.

- **Heading:** `Welcome back` (personalise to `Welcome back, {displayName}` **only** if the server resolver supplied
  a name — it can never be a client fetch; default generic, §12.8).
- **Sub:** `Enter your PIN to continue to {appName}.`
- **Field — `PinInput` = `OtpInput` extended, not forked.** Add `mask?: boolean` + `autoComplete?` props to
  `OtpInput` (today `autoComplete="one-time-code"` is hard-coded on box 0, `OtpInput.tsx:141`, and boxes render
  visible `type="text"`, `:139,146`). PIN uses `mask` (per-box `type=password`, `inputmode="numeric"`),
  `autoComplete="off"` (**never** `one-time-code` — this is a chosen secret), `autoFocus`. Keep the existing
  group-label + per-box `aria-label` (`:130,145`) — they read identically masked (`"Digit 1 of 6"` for a dot).
- **Errors (`aria-live="assertive"`):** wrong PIN → `That PIN isn't right. {n} attempts left.` On lockout → route to
  the **reset flow** (§12.5), copy `Too many tries — we'll text you a code to reset your PIN.`
- **Escape hatches (both essential, both server actions):**
  - **`Forgot PIN?`** → server-driven OTP → reset (§12.5). The only SMS trigger here.
  - **`Not you?`** → calls **`onForgetDevice`** (`/auth/device/forget`) to actually clear the httpOnly device cookie,
    *then* goes to phone entry. (A client-only flag would leave the cookie in place and revert to PIN on next load — a trap.)
- **No resend, no cooldown timer.**

### 12.5 PIN setup — two distinct placements (NEW)

- **First-run setup lives on the onboarding/dashboard route, NOT in AuthFlow.** After OTP, `onSuccess` does
  `router.replace('/onboarding')` and AuthFlow unmounts (`login/page.tsx`), so "set a PIN after onboarding" happens on
  a later screen. Build it there.
- **Post-reset setup lives inside AuthFlow** as the `pin-setup` step (reached from forgot-PIN/lockout).
- Both: **enter → confirm** (mismatch → `Those didn't match — try again.`), weak-PIN guard mirroring the server
  blocklist (§7.3) → `Pick something harder to guess.`, and the **double-submit lock added to `onSetPin`/`onVerifyPin`**
  (the current lock guards OTP verify only, `AuthFlow.tsx:149-157`). Confirm is AuthFlow sub-state, not a component concern.

### 12.6 Forgot PIN / lockout (server-driven, reuses OTP + reset)

From PIN entry (or on lockout) → **`onForgotPin`** triggers a **server-driven** OTP send (BFF resolves the phone —
the client has none here) → OTP screen in reset mode (§12.3) → **`pin-setup`** reset. Rate-limited + budget-capped (§7).

### 12.7 Cross-cutting UX rules

- **Never conflate PIN and OTP.** OTP = *"the code we sent"* (temporary, visible, `one-time-code`). PIN = *"your PIN"*
  (chosen, durable, masked, no autofill). Different words, masking, screens.
- **Focus:** treat `pin-entry`/`pin-setup` like `otp` — **exclude from the heading-focus effect** (`AuthFlow.tsx:115`)
  and let the field `autoFocus`. (§12.4 autofocus and a "focus the heading" rule contradict; the field wins.)
- **Both themes, every new screen** — one Storybook story per theme (creator-dark / learner-light), Pulse-green
  accent, error-red, WCAG-AA in both `data-theme` states (0008 §B.8). Interaction tests: see §11.
- **Double-submit lock** on PIN verify/set (net-new code, §12.5). Mirror the demo-default pattern
  (`onVerifyOtp ?? …`, `AuthFlow.tsx:155`) for `onVerifyPin`/`onSetPin` so stories run without a backend.

### 12.8 Data availability note — `displayName`

`Welcome back, {name}` before auth is only possible via the **server resolver** (§12.1): at `pin-entry` there is no
live session, `/auth/me` requires a bearer (`auth.controller.ts:28`), and the env policy forbids client-held
identity. The resolver maps the trusted-device row → name server-side and passes it as a prop. It is **not** a prop
the login page can conjure. Default to generic `Welcome back` unless product accepts server-rendering the name into
the PIN screen for anyone holding the device (§12 open decisions).

---

## 13. Open decisions (non-blocking)

1. **PIN scope** — per `Account` (one PIN, both apps) vs per membership/workspace. Lean per-Account; but then §7.3
   strength rules are non-negotiable and creator-side sensitive actions must still OTP-step-up (§7.8). Revisit
   per-workspace if the creator surface ever holds real value.
2. **Absolute cap** — 30 days (recommended) vs a quarter. Start 30, tune with data.
3. **"Remember this device" across explicit logout** — logout clears device trust by default (safer); optional keep-trust is a later toggle.
4. **PIN length** — **6 recommended** (§7.3). 4 only if product insists *and* the full blocklist + pepper are in place.
5. **First-run PIN setup placement** — onboarding/dashboard route (required by §12.5), enforced vs `Skip for now`
   (off by default — each skip = an OTP-every-time user).
6. **Returning greeting** — server-render `displayName` (minor leak on a shared device) vs generic `Welcome back` (default).
7. **Forgot-PIN throttle** — reuse OTP cooldown/cap vs a tighter dedicated limit, under the global budget breaker (§7.7).
8. **Biometric unlock** (WebAuthn / platform authenticator) — future free, phishing-resistant PIN replacement on capable devices. Out of scope now.
