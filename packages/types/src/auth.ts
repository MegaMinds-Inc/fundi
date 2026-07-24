import type { AppClient } from './app-client';
import type { MentorRole } from './mentor-role';

// Shared auth/identity DTOs (plan A.7). Live here so the NestJS API and the
// Next.js BFFs cannot drift on the wire shape of the auth pipeline.

/**
 * Access-token pair returned to the BFF. The refresh token itself never rides
 * in a response body — it lives in an httpOnly cookie (plan A.4) — so only the
 * access token and its lifetime are surfaced here.
 */
export interface AuthTokens {
  accessToken: string;
  /** Access-token lifetime in seconds (15m per pre-decided default). */
  expiresIn: number;
}

/**
 * Result of `POST /auth/refresh`. The rotated refresh token is set as a fresh
 * httpOnly cookie by the BFF; the body carries only the re-minted access token
 * (which now carries the resolved `org` claim). Same shape as {@link AuthTokens}.
 */
export type RefreshResult = AuthTokens;

/**
 * The authenticated principal, decoded from the access JWT. Mirrors the token
 * claims: `sub` (accountId), `org` (active organisationId, omitted until the
 * creator has bootstrapped an org), `role`, `app`.
 */
export interface Principal {
  accountId: string;
  /** Active organisation id, or omitted for an org-less onboarding token. */
  org?: string;
  role: MentorRole;
  app: AppClient;
}

/** One organisation the account belongs to, with the row it maps to there. */
export interface MembershipDTO {
  organisationId: string;
  organisationName: string;
  role: MentorRole;
  /** Set when the membership resolves to a Mentor row in that org. */
  mentorId?: string;
  /** Set when the membership resolves to a Learner row in that org. */
  learnerId?: string;
}

/**
 * Result of `POST /auth/otp/verify`. When the account has no membership yet
 * (first-time creator), `tokens` is still issued but as an org-less onboarding
 * token and `needsOnboarding` is true (plan A.6 / pre-decided onboarding flow).
 */
export interface VerifyOtpResult {
  tokens?: AuthTokens;
  needsOnboarding: boolean;
  memberships: MembershipDTO[];
  /**
   * True when the account has no PIN yet (`pinHash` is null) and the first-run
   * PIN-setup nudge should be shown (feature 0010 §6). Enrollment (OTP) is where
   * device trust is minted, so this rides on the verify result.
   */
  needsPinSetup: boolean;
}

/**
 * Result of `POST /auth/pin/verify` (device + PIN step-up, feature 0010 §4.3/§6).
 * Mints a fresh token pair with no SMS; the rotated device secret is set as a
 * fresh cookie by the BFF (never surfaced to the browser). Same body shape the
 * browser sees as any other token-issuing endpoint — only the access token +
 * memberships reach JS.
 */
export interface PinVerifyResult {
  tokens: AuthTokens;
  memberships: MembershipDTO[];
}

/** Result of `POST /auth/pin/set` (feature 0010 §7.1). */
export interface SetPinResult {
  ok: true;
}

/**
 * Result of `GET /auth/me` — the principal + memberships for the UI auth state,
 * plus `needsPinSetup`: live DB state (`pinHash == null`), NOT a token claim, so
 * the mandatory PIN-setup gate (feature 0010 CHANGE 1) self-clears the instant a
 * PIN is set and never loops on a stale token. The PIN hash is never surfaced.
 */
export interface MeResult {
  principal: Principal;
  memberships: MembershipDTO[];
  needsPinSetup: boolean;
}

/**
 * Body of `POST /auth/pin/set` (feature 0010 §7.1). First-time set (no existing
 * PIN) is allowed on session auth alone; a *replace* MUST carry a fresh proof —
 * the current PIN (`currentPin`) or a just-issued OTP code (`otpCode`) for the
 * account's phone — never a bare access token.
 */
export interface PinSet {
  pin: string;
  currentPin?: string;
  otpCode?: string;
}

/** Body of `POST /auth/pin/verify` (device-cookie-gated step-up). */
export interface PinVerify {
  pin: string;
  app: AppClient;
}

/** Body of `POST /auth/pin/forgot` (server-driven reset; the client holds no phone). */
export interface PinForgot {
  app: AppClient;
}

/**
 * Body of `POST /auth/pin/reset` (forgot-PIN reset, feature 0010 §4.6/§12.6).
 * The client holds NO phone: the reset OTP (`otpCode`) is the phone-ownership
 * proof and `pin` is the new PIN — both submitted together in ONE call. The API
 * resolves the account from the device cookie, consumes the OTP, sets the new
 * PIN, and mints a fresh signed-in session. The response is a {@link PinVerifyResult}.
 */
export interface PinReset {
  otpCode: string;
  pin: string;
  app: AppClient;
}

/** Body of `POST /auth/device/forget` (clears the current trusted-device row). */
export interface DeviceForget {
  app: AppClient;
}

/** Body of `POST /auth/otp/request`. Phone is a friendly local format; the API normalizes to E.164. */
export interface OtpRequest {
  phone: string;
}

/** Body of `POST /auth/otp/verify`. */
export interface OtpVerify {
  phone: string;
  code: string;
  app: AppClient;
}

/**
 * Body of `POST /auth/onboarding`. Bootstraps the Organisation + owner Mentor +
 * Membership for a first-time creator, then re-issues a token with the `org`
 * claim (pre-decided onboarding flow).
 */
export interface Onboarding {
  orgName: string;
  name: string;
}
