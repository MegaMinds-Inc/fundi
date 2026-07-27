# 0009 — Real OTP SMS Delivery: pluggable provider seam + Vynfy adaptor (plan)

> **Status:** planning (plan-only — no code yet) · **Follows:** [0008](0008-sprint-1-auth-and-org-scoping.md) (auth pipeline, OTP stub) ·
> **Owners:** Backend (API driver + config), Ops (Vynfy account, sender-ID approval, secrets).
> **Goal:** promote OTP delivery from the Sprint-1 console stub to a **real SMS** send, behind a
> **provider-agnostic seam** so the concrete provider (Vynfy first) can be swapped by config alone —
> no changes to `OtpService`, `AuthService`, the controller, or the frontends.

---

## 1. Where we are today

The seam already exists and is clean:

- `OtpService.request(phone)` (`apps/api/src/modules/auth/otp.service.ts:42`) owns the **entire code
  lifecycle** — generation (`node:crypto` `randomInt`), scrypt hashing over a per-row salt, the
  `OtpChallenge` row, resend cooldown, rolling issuance cap, attempt cap, single-use consumption. It
  ends with a single call: `await this.delivery.send(phone, code)`.
- `OtpDeliveryService` (`otp-delivery.service.ts:9`) is an **abstract class used as the DI token**.
  Contract: *"deliver `code` to `phone`; must not throw on transient failure in a way that leaks
  whether the phone exists (no enumeration)."*
- Today it binds to `StubOtpDeliveryService` (`auth.module.ts:55`), which logs and (non-prod only)
  records the last code for tests.

**Everything above `OtpDeliveryService.send()` stays untouched by this feature.** We are only adding a
real implementation of that one method and a way to select it.

---

## 2. Key decision — transport-only, NOT provider-managed OTP  ⭐

Vynfy exposes **two** ways to do OTP (confirmed from `https://sms.vynfy.com/api/v1/docs`):

| | **Path A — generic SMS transport** (recommended) | **Path B — Vynfy-managed OTP** |
|---|---|---|
| Endpoint | `POST /api/v1/send` (plain SMS) | `POST /otp/generate` + `POST /otp/verify` |
| Who owns the code | **We do** (existing `OtpService`) | **Vynfy does** (their store, their verify) |
| Our OTP lifecycle | kept as-is (hashing, `OtpChallenge`, cooldown, attempt cap, replay) | **deleted / bypassed** |
| `AuthService.verify` | unchanged | rewritten to call Vynfy `/otp/verify` |
| Provider swap cost | trivial — just another `SmsProvider` adaptor | high — verify logic is provider-shaped |
| Lock-in | none (any SMS provider works) | strong (code storage + verify semantics are Vynfy's) |

**Decision: Path A.** It fits the existing seam exactly (`send(phone, code)` = "send this text"), keeps
our hardened, tenant-safe, replay-protected lifecycle, and is the only path consistent with the stated
goal — *"change to another service at any time without a lot of changes."* Path B is recorded here as
a rejected alternative; revisit only if we want Vynfy's USSD retrieval (`*928*01#`) or voice OTP and
are willing to accept the lock-in.

> Net effect of Path A: our OTP code travels inside a normal transactional SMS whose body we template.
> Vynfy's OTP-specific balance, `otp_id`, and verify endpoint are **not used**.

---

## 3. Target architecture — three layers behind the existing token

```
OtpService  ──depends on──►  OtpDeliveryService            (abstract token — UNCHANGED)
                                     ▲
                     ┌───────────────┴───────────────┐
             StubOtpDelivery                  SmsOtpDeliveryService   (NEW — provider-agnostic)
             (dev/CI default)                        │  builds the message, applies sender ID,
                                                     │  normalises provider errors, enumeration-safe
                                                     ▼
                                              SmsProvider            (NEW abstract token — the swap point)
                                                     ▲
                                   ┌─────────────────┼─────────────────┐
                             VynfySmsProvider   (TwilioSmsProvider)  (ArkeselSmsProvider) …
                              (NEW, first)         (future)            (future)
```

- **`SmsOtpDeliveryService implements OtpDeliveryService`** — provider-*agnostic*. Owns: the message
  template (`Your Fundi code is {code}. It expires in N minutes. Never share it.`), the sender ID,
  the "never log the code in prod" rule, and mapping any provider failure to the enumeration-safe
  contract. It depends on the `SmsProvider` token, not on Vynfy.
- **`SmsProvider`** (new abstract class / DI token) — the **only** thing a new provider implements:
  ```ts
  abstract class SmsProvider {
    abstract sendSms(input: { to: string; message: string; senderId: string }):
      Promise<{ providerMessageId?: string }>;   // resolves on accepted; throws SmsProviderError otherwise
  }
  ```
- **`VynfySmsProvider implements SmsProvider`** — the concrete adaptor (§4).

Adding Twilio/Arkesel/Hubtel later = one new `SmsProvider` class + a registry entry. No other file
changes.

### Selection (config-driven, wired in `auth.module.ts` via `useFactory`)

```
OTP_DELIVERY_DRIVER = stub | sms          # default: stub (dev + CI)
SMS_PROVIDER        = vynfy               # only read when driver = sms
```

Factory logic:
- `stub` (or unset) → `StubOtpDeliveryService` (current behaviour; **CI never hits the network**).
- `sms` → `SmsOtpDeliveryService` composed with the `SmsProvider` chosen by `SMS_PROVIDER`
  (a small `switch`/registry; unknown value = fail fast at boot, not at first send).

Fail-fast on boot: if `OTP_DELIVERY_DRIVER=sms` but required provider secrets are missing, throw during
DI so a misconfigured deploy never silently drops OTPs.

---

## 4. Vynfy adaptor — the real contract (from live `/api/v1/docs`, v1.0)

- **Base URL:** `https://sms.vynfy.com`
- **Auth:** header **`X-API-Key: <key>`** (not Bearer).
- **Send endpoint (Path A):** `POST /api/v1/send`, `Content-Type: application/json`
  ```json
  { "recipients": "+233552148347", "sender": "Fundi", "message": "Your Fundi code is 123456 …" }
  ```
  - `recipients`: string **or** array. We send a single E.164 string (one OTP → one number).
  - `sender`: the sender ID, **≤ 11 chars, must be pre-registered & approved** (see §7).
  - `message`: ≤ 650 chars (we stay ≤ 160 — single SMS segment, per Vynfy OTP best-practice).
  - optional `metadata`: object — attach `{ purpose: "otp" }` for provider-side tracking/filtering.
- **Success:** `200`
  ```json
  { "success": true, "data": { "recipients_count": 1, "status": "queued",
    "task_id": "6f461b5a-…" }, "balance": { "deducted": 1, "remaining": 1357 } }
  ```
  → treat `success === true` as accepted; keep `data.task_id` as `providerMessageId` for logs/receipts.
- **Errors (HTTP):** `400` bad request · `402` **payment required = out of SMS balance** ·
  `403` forbidden (bad key / unapproved sender) · `422` validation · `429` too many requests ·
  `500` server. Body carries a message; `success: false`.
- **Sandbox (for the smoke phase / staging):** `POST /smssandbox/v1/send` — same body, **not delivered**.
  Selected by `VYNFY_SANDBOX=true` (adaptor swaps the path only).
- **Phone format:** Vynfy accepts `233…`, `+233…`, `0…`. We already normalise to E.164 `+233…` in
  `PhoneService` (`DEFAULT_PHONE_REGION = 'GH'`) → **fully compatible, no change**.

> Not used by Path A but noted for later: `/otp/generate` + `/otp/verify` (managed OTP, §2 Path B),
> `/otp/balance` & `/api/v1/check/balance` (balance monitoring, §8), `/sender/id/register` +
> `/sender/id/status` (sender-ID lifecycle, §7), webhooks for delivery receipts (§8), voice OTP.

---

## 5. Config / env contract (server-side only — per env policy, never `NEXT_PUBLIC`)

Add to `apps/api/.env.example` (documented, no real values) and to prod secrets (Render):

```bash
# --- OTP delivery ---
OTP_DELIVERY_DRIVER=stub          # stub (default; dev + CI) | sms
SMS_PROVIDER=vynfy                # active provider when driver=sms
SMS_SENDER_ID=Fundi               # ≤11 chars, must be APPROVED with the provider
OTP_MESSAGE_TEMPLATE="Your Fundi code is {code}. Expires in {minutes} min. Never share it."  # optional; code default otherwise

# --- Vynfy (read only when SMS_PROVIDER=vynfy) ---
VYNFY_API_KEY=                    # secret — X-API-Key
VYNFY_BASE_URL=https://sms.vynfy.com
VYNFY_SANDBOX=false               # true → /smssandbox/v1/send (no real delivery)
```

- New constants/parsing live in `auth.constants.ts` next to the existing OTP knobs, resolved at DI
  time (same pattern as `resolveJwtSecret()`), so tests inject fixtures and nothing is captured at
  import time.
- `{minutes}` in the template is derived from the existing `OTP_TTL_MS` so message copy can't drift
  from actual expiry.

---

## 6. Error handling & the enumeration-safe contract

The seam contract says `send` **must not** throw in a way that leaks phone existence, and
`OtpService.request` returns `void` so the controller can always answer `204`. The challenge row is
already persisted **before** `send` is called. Therefore:

- `VynfySmsProvider` throws a typed `SmsProviderError` (with provider status + code) on any non-`success`.
- `SmsOtpDeliveryService` **catches**, logs at `error`/`warn` (structured; **never the code, never in a
  form tied to whether the number is a real user**), and returns normally — preserving the `204`.
- **Exceptions to swallow-and-continue:**
  - `402 payment_required` (out of balance) → log `error` + emit an **ops alert** (§8). Delivery is
    impossible system-wide; this is not a per-user condition.
  - `403` on sender ID / key → same: a deploy-level misconfiguration, alert loudly.
- HTTP call uses a **timeout** (e.g. 8s) and **no auto-retry** — our `OtpService` already enforces a
  resend cooldown and rolling cap; a blind retry risks double-charging and double-texting. A single
  network failure is logged and swallowed (user can re-request after cooldown).
- Vynfy's own guidance (3 OTPs/hour/number) is already covered by our cooldown + `OTP_ISSUANCE_CAP`
  window — confirm the constants are ≤ Vynfy's ceiling so we reject before they do.

---

## 7. Operational prerequisites (Ops — blockers for *live* send, not for merging code)

1. **Vynfy account + API key** provisioned; key stored as a Render secret (never committed).
2. **Sender ID `Fundi` registered and APPROVED** via `POST /sender/id/register` → poll
   `GET /sender/id/status` until `approved`. Sending with an unapproved/`pending` sender ID fails
   (`403`). This has lead time — start early. ≤ 11 chars.
3. **SMS balance funded**; wire the balance alert (§8) before go-live.
4. Staging uses `VYNFY_SANDBOX=true` (accepted but not delivered) until we run the one live smoke test.

---

## 8. Follow-ons (explicitly out of this plan; file as separate tasks)

- **Balance monitoring / low-balance alert** — periodic `GET /api/v1/check/balance`, alert under a
  threshold. Prevents silent `402` outages.
- **Delivery receipts via webhooks** — Vynfy posts `delivered` / `expired` / `failed` with a
  `message_id` and a signature header. A future API webhook endpoint (200-immediately, idempotent on
  `message_id`, signature-verified) would give real delivery observability. Not required for OTP to work.
- **WhatsApp fallback / voice OTP** — the deferred ADR-001 channel. If pursued, that is where Vynfy's
  managed-OTP (`medium: "voice"`) or a WhatsApp provider would slot in — as another `SmsProvider`-style
  adaptor, and the auth-step copy would then name the actual channel (0008 §B.1). Not now.

---

## 9. File-by-file change list (for the implementation pass)

**New:**
- `apps/api/src/modules/auth/sms-provider.ts` — `SmsProvider` abstract token + `SmsProviderError`.
- `apps/api/src/modules/auth/providers/vynfy-sms.provider.ts` — `VynfySmsProvider` (fetch-based, injectable HTTP for testability).
- `apps/api/src/modules/auth/sms-otp-delivery.service.ts` — `SmsOtpDeliveryService` (templating + error normalisation).
- `apps/api/src/modules/auth/providers/vynfy-sms.provider.test.ts` — adaptor unit tests (fake fetch: success, `402`, `422`, `403`, network timeout, message templating, E.164 pass-through). `node:test` + `node:assert/strict`, matching repo convention.

**Edited:**
- `apps/api/src/modules/auth/auth.constants.ts` — resolve `OTP_DELIVERY_DRIVER`, `SMS_PROVIDER`, `SMS_SENDER_ID`, `OTP_MESSAGE_TEMPLATE`, Vynfy vars; fail-fast validation.
- `apps/api/src/modules/auth/auth.module.ts` — replace the static `{ provide: OtpDeliveryService, useClass: StubOtpDeliveryService }` with a `useFactory` that returns stub or `SmsOtpDeliveryService(+provider)` by config; register `SmsProvider` factory.
- `apps/api/.env.example` — document the block in §5.
- `apps/api/src/modules/auth/otp-delivery.service.ts` — no logic change (contract already fits); optionally add a doc line pointing at the real driver.

**Unchanged (proof the seam holds):** `otp.service.ts`, `auth.service.ts`, `auth.controller.ts`,
`phone.service.ts`, all `apps/*/app/api/auth/*` BFF routes, all frontends.

---

## 10. Testing strategy

- **CI stays offline:** CI leaves `OTP_DELIVERY_DRIVER` unset → stub. Existing integration tests
  (`auth.integration.test.ts`, `org-binding.integration.test.ts`) and the `lastCodeFor` peek are
  unaffected.
- **Adaptor unit tests** (new) inject a fake `fetch`: assert request shape (`X-API-Key`, `recipients`,
  `sender`, `message ≤160`, E.164 body), success parsing (`task_id`), and each error → `SmsProviderError`
  with the right classification; assert the code is never in a logged string.
- **Delivery-service test:** provider throws → `send` resolves (enumeration-safe), and `402/403` trigger
  the alert path.
- **Manual live smoke (deferred until Ops §7 done):** `OTP_DELIVERY_DRIVER=sms`, `VYNFY_SANDBOX=false`,
  request an OTP to a real GH test number, confirm receipt end-to-end. This is the only step needing
  real credentials and is intentionally out of the plan-only scope the user chose.

---

## 11. Open decisions (non-blocking)

1. **Sender ID string** — `Fundi`? (≤11 chars). Needs Ops to register/approve; pick the exact brand string.
2. **Message copy & language** — final OTP SMS wording (English only for now? matches 0008 SMS copy).
3. **Alerting channel** for `402`/`403`/low-balance — Slack webhook, Sentry, or log-only for v1.
4. **`metadata` usage** — attach `{ purpose: "otp", env }` for Vynfy-side filtering? (cheap, recommended.)
