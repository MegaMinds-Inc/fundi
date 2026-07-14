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
