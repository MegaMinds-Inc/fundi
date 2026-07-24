/**
 * Central, tweakable auth constants (pre-decided Sprint 1 defaults). Grouped
 * here so the whole team reads the same numbers and a product change is a
 * one-line edit rather than a hunt through services.
 */

/**
 * Default region libphonenumber-js parses bare local numbers against (e.g.
 * `080…`/`020…`). GH (+233) matches the built AuthFlow component and the
 * Africa/Accra timezone default. Exposed as a constant so switching the launch
 * market is trivial. (needs-confirm: the mockup placeholder used a Nigerian
 * `080` format; the shipped component used +233 — GH was chosen to match the
 * shipped component.)
 */
export const DEFAULT_PHONE_REGION = 'GH';

// --- JWT (access token) -----------------------------------------------------

/** Access-token lifetime in seconds (15 minutes). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Clock leeway (seconds) tolerated on `exp`/`iat` verification, so a token a
 * few seconds past expiry against a slightly-skewed clock is not spuriously
 * rejected (QA C.5 / D.6).
 */
export const JWT_CLOCK_TOLERANCE_SECONDS = 30;

/**
 * Resolve the HS256 signing secret at DI time (never at import time, so tests
 * can inject a fixed key first). A dev fallback keeps localhost frictionless;
 * production MUST set `JWT_SECRET` — using the fallback there is refused loudly.
 */
export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set in production — refusing to sign access tokens with the dev fallback.',
    );
  }
  return 'dev-only-insecure-jwt-secret-do-not-use-in-prod';
}

// --- Refresh token ----------------------------------------------------------

/** Refresh-token lifetime in seconds (30 days). */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Bytes of entropy in an opaque refresh token before base64url encoding. */
export const REFRESH_TOKEN_BYTES = 32;

// --- Refresh re-auth clocks (feature 0010 §3) -------------------------------
// Two independent clocks gate silent refresh; each check reads exactly ONE
// authoritative field (§9): idle off the presented token's `createdAt`, the
// absolute cap off the immutable `familyExpiresAt`. Do not run both off one
// field. `ACCESS_TOKEN_TTL_SECONDS` (15m) and `REFRESH_TOKEN_TTL_SECONDS`
// (per-row idle deadline) are unchanged.

/**
 * Idle re-auth window (3 days). When `now − presentedToken.createdAt` exceeds
 * this, refresh returns `reauth_required` and the user must step up with a PIN.
 */
export const REFRESH_IDLE_TIMEOUT_SECONDS = 3 * 24 * 60 * 60;

/**
 * Absolute session cap (30 days). When `now > familyExpiresAt` (anchored at
 * family birth, never extended), refresh returns `session_expired` → PIN.
 */
export const REFRESH_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Reuse-detection grace window (ms) for the pre-read `revokedAt` branch of
 * `rotateRefreshToken` (feature 0010 H1 remediation). Presenting an
 * already-rotated token is USUALLY theft — and burns the family + device trust
 * (§7.4). But a benign cross-tab/prefetch refresh race (two isolates present
 * the same still-valid token microseconds apart; the Edge single-flight cannot
 * span the Node BFF) is indistinguishable from a replay at the HTTP layer. If
 * the token was revoked within this window AND exactly one legitimate rotation
 * happened (its replacement is still live and itself un-rotated), we treat it as
 * that race → `invalid_grant` WITHOUT family/device revocation, so a legitimate
 * user is not logged out and de-enrolled over a race. Kept SMALL: an attacker
 * replaying a stolen token is vanishingly unlikely to land inside this sub-5s
 * window immediately after a legit rotation, and ANY reuse outside it (or after
 * the replacement itself rotates) still trips full revocation.
 */
export const REFRESH_REUSE_GRACE_MS = 5_000;

// --- PIN step-up credential (feature 0010 §7) -------------------------------

/** Minimum PIN length in digits (§7.3 — 6, not 4; 4 only behind a blocklist). */
export const PIN_LENGTH_MIN = 6;

/** Maximum PIN length in digits (fixed 6 unless product overrides). */
export const PIN_LENGTH_MAX = 6;

/** Wrong-PIN attempts per DEVICE before the timed backoff kicks in (§7.5). */
export const PIN_MAX_ATTEMPTS = 5;

/**
 * Escalating, self-healing lockout backoff (seconds) after the attempt cap is
 * hit. Indexed by consecutive lockout round; the last value repeats. Timed and
 * self-clearing — a burst of bad guesses never auto-costs an SMS (§7.5).
 */
export const PIN_LOCKOUT_BACKOFF_SECONDS = [30, 120, 600];

/** scrypt key length (bytes) for the stored PIN hash (mirrors OTP_SCRYPT_KEYLEN). */
export const PIN_SCRYPT_KEYLEN = 32;

/**
 * Resolve the HMAC pepper applied over the scrypt PIN output at DI time (never
 * at import time, so tests can inject a fixed key first). The key is held in
 * env/KMS OUTSIDE the DB so a DB-only leak yields nothing crackable offline
 * (§7.3). A dev fallback keeps localhost frictionless; production MUST set
 * `PIN_PEPPER` — using the fallback there is refused loudly. Exact mirror of
 * {@link resolveJwtSecret}.
 */
export function resolvePinPepper(): string {
  const pepper = process.env.PIN_PEPPER;
  if (pepper && pepper.length > 0) {
    return pepper;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PIN_PEPPER must be set in production — refusing to hash PINs with the dev fallback.',
    );
  }
  return 'dev-only-insecure-pin-pepper-do-not-use-in-prod';
}

// --- Trusted device (feature 0010 §5) ---------------------------------------

/** Trusted-device enrollment lifetime in seconds (180 days). */
export const TRUSTED_DEVICE_TTL_SECONDS = 180 * 24 * 60 * 60;

// --- Global SMS budget circuit-breaker (feature 0010 §7.7) ------------------

/**
 * Resolve the org-wide daily SMS send ceiling from `SMS_DAILY_BUDGET`. Returns
 * `null` when unset or non-positive — the breaker is OFF (no ceiling). When set
 * to a positive integer, that is the fail-closed daily cap covering enrollment
 * AND forgot-PIN sends (§7.7).
 */
export function resolveSmsDailyBudget(): number | null {
  const raw = (process.env.SMS_DAILY_BUDGET ?? '').trim();
  if (raw.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

// --- Auth cookie SameSite (feature 0010 §7.6) -------------------------------

/**
 * SameSite attribute for all auth cookies. `strict` is explicit (was unset —
 * §7.6); `__Host-` gives origin isolation but NOT CSRF protection. Use `lax`
 * only where a top-level navigation must carry the cookie.
 */
export const AUTH_COOKIE_SAMESITE = 'strict';

// --- OTP --------------------------------------------------------------------

/** Number of digits in an OTP code. */
export const OTP_CODE_LENGTH = 6;

/** How long an OTP challenge stays valid, in milliseconds (5 minutes). */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Max wrong verify attempts before a challenge is locked. */
export const OTP_MAX_ATTEMPTS = 5;

/** Max OTP challenges a single phone may be issued per rolling window. */
export const OTP_ISSUANCE_CAP = 5;

/** The rolling issuance-cap window, in milliseconds (1 hour). */
export const OTP_ISSUANCE_WINDOW_MS = 60 * 60 * 1000;

/** Minimum gap between two OTP requests for the same phone (30s, matches UI). */
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

/** scrypt key length (bytes) for the stored OTP hash. */
export const OTP_SCRYPT_KEYLEN = 32;

// --- Per-IP throttle (otp/request) ------------------------------------------

/** Throttle window for `POST /auth/otp/request`, in milliseconds. */
export const OTP_REQUEST_THROTTLE_TTL_MS = 60 * 1000;

/** Max `POST /auth/otp/request` calls per IP per window. */
export const OTP_REQUEST_THROTTLE_LIMIT = 10;

// --- OTP delivery (SMS) — feature 0009 --------------------------------------

/** OTP code lifetime in whole minutes, for message copy (derived from OTP_TTL_MS). */
export const OTP_EXPIRY_MINUTES = Math.round(OTP_TTL_MS / 60_000);

/** Default OTP SMS copy. `{code}`/`{minutes}` are filled at send time. ≤160 chars. */
export const DEFAULT_OTP_MESSAGE_TEMPLATE =
  'Your Fundi code is {code}. It expires in {minutes} min. Never share it.';

/** How long to wait on the provider's HTTP call before aborting (no retry). */
export const SMS_SEND_TIMEOUT_MS = 8_000;

/** Vynfy API root when `VYNFY_BASE_URL` is unset. */
export const VYNFY_DEFAULT_BASE_URL = 'https://sms.vynfy.com';

/** Which delivery driver backs `OtpDeliveryService`. */
export type OtpDeliveryDriver = 'stub' | 'sms';

/** SMS providers with a shipped adaptor (extend as new ones are added). */
export type SmsProviderName = 'vynfy';

/** Resolved Vynfy transport config (assembled from env at DI time). */
export interface ResolvedVynfyConfig {
  apiKey: string;
  baseUrl: string;
  sandbox: boolean;
  timeoutMs: number;
}

/**
 * Which OTP delivery driver to wire. Defaults to `stub` (dev + CI never touch
 * the network); `sms` selects the real provider path. Any other value fails
 * fast at boot rather than silently dropping codes.
 */
export function resolveOtpDeliveryDriver(): OtpDeliveryDriver {
  const raw = (process.env.OTP_DELIVERY_DRIVER ?? 'stub').trim().toLowerCase();
  if (raw === '' || raw === 'stub') {
    return 'stub';
  }
  if (raw === 'sms') {
    return 'sms';
  }
  throw new Error(`OTP_DELIVERY_DRIVER must be 'stub' or 'sms' (got '${raw}').`);
}

/** The active SMS provider (only read when the driver is `sms`). */
export function resolveSmsProviderName(): SmsProviderName {
  const raw = (process.env.SMS_PROVIDER ?? 'vynfy').trim().toLowerCase();
  if (raw === 'vynfy') {
    return 'vynfy';
  }
  throw new Error(`SMS_PROVIDER '${raw}' is not supported. Known providers: vynfy.`);
}

/** The registered/approved sender ID. Required (and ≤11 chars) for real SMS. */
export function resolveSmsSenderId(): string {
  const id = (process.env.SMS_SENDER_ID ?? '').trim();
  if (id.length === 0) {
    throw new Error('SMS_SENDER_ID must be set when OTP_DELIVERY_DRIVER=sms.');
  }
  if (id.length > 11) {
    throw new Error(`SMS_SENDER_ID must be ≤11 characters (got ${id.length}).`);
  }
  return id;
}

/** The OTP message template, falling back to {@link DEFAULT_OTP_MESSAGE_TEMPLATE}. */
export function resolveOtpMessageTemplate(): string {
  const template = (process.env.OTP_MESSAGE_TEMPLATE ?? '').trim();
  return template.length > 0 ? template : DEFAULT_OTP_MESSAGE_TEMPLATE;
}

/** Assemble Vynfy config from env; fails fast if the API key is missing. */
export function resolveVynfyConfig(): ResolvedVynfyConfig {
  const apiKey = (process.env.VYNFY_API_KEY ?? '').trim();
  if (apiKey.length === 0) {
    throw new Error('VYNFY_API_KEY must be set when SMS_PROVIDER=vynfy.');
  }
  const baseUrl = (process.env.VYNFY_BASE_URL ?? '').trim() || VYNFY_DEFAULT_BASE_URL;
  return {
    apiKey,
    baseUrl,
    sandbox: parseBooleanEnv(process.env.VYNFY_SANDBOX, false),
    timeoutMs: SMS_SEND_TIMEOUT_MS,
  };
}

/** Parse a boolean-ish env value; unknown/empty falls back. */
function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) {
    return fallback;
  }
  const value = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) {
    return true;
  }
  if (['false', '0', 'no', 'off', ''].includes(value)) {
    return false;
  }
  return fallback;
}

// --- BFF cookie names (the API reads these; the BFF sets them) --------------

/**
 * Cookie names the BFF uses. In production the `__Host-` prefix is required
 * (Secure + Path=/ + no Domain); on http localhost it is dropped so the cookie
 * still sets (dev fallback). The API only ever *reads* a token from the cookie
 * as a fallback to the `Authorization: Bearer` header — it never sets cookies.
 */
export const ACCESS_COOKIE_NAME = 'fundi_at';
export const REFRESH_COOKIE_NAME = 'fundi_rt';
export const ACCESS_COOKIE_NAME_HOST = `__Host-${ACCESS_COOKIE_NAME}`;
export const REFRESH_COOKIE_NAME_HOST = `__Host-${REFRESH_COOKIE_NAME}`;

/**
 * Trusted-device credential cookie (feature 0010 §5/§7.2). Carries the opaque
 * high-entropy device secret (only its SHA-256 is stored server-side). Same
 * `__Host-` construction as the access/refresh cookies — httpOnly, Secure,
 * `Path=/`, `SameSite` from {@link AUTH_COOKIE_SAMESITE}, `Max-Age` from
 * {@link TRUSTED_DEVICE_TTL_SECONDS}. Set on enrollment (otp/verify) and rotated
 * on every step-up (pin/verify); cleared on logout + device/forget.
 */
export const DEVICE_COOKIE_NAME = 'fundi_dt';
export const DEVICE_COOKIE_NAME_HOST = `__Host-${DEVICE_COOKIE_NAME}`;
