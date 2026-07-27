import type { AuthTokens, MembershipDTO, Principal } from '@fundi/types';

/**
 * The token bundle the API returns to the BFF. It is a superset of the
 * browser-facing {@link AuthTokens}: it additionally carries the opaque
 * `refreshToken` so the BFF can set the `fundi_rt` httpOnly cookie. This value
 * travels only server-to-server (API → BFF) and is stripped by the BFF before
 * anything reaches the browser — the browser only ever holds the cookie, never
 * a token in JS (plan A.4). Structurally assignable to `AuthTokens`.
 */
export interface IssuedTokens extends AuthTokens {
  refreshToken: string;
  /** Refresh-token lifetime in seconds (informs the BFF cookie Max-Age). */
  refreshExpiresIn: number;
}

/** API response for `POST /auth/otp/verify`. `tokens` widens `AuthTokens` to
 * {@link IssuedTokens}; the shape still satisfies the shared `VerifyOtpResult`.
 * `deviceSecret` is the freshly-minted trusted-device secret (feature 0010 §6):
 * it travels only server-to-server (API → BFF), which sets the `__Host-fundi_dt`
 * cookie and strips it before anything reaches the browser — exactly the
 * `refreshToken` handling on {@link IssuedTokens}. */
export interface VerifyOtpApiResult {
  tokens?: IssuedTokens;
  needsOnboarding: boolean;
  memberships: MembershipDTO[];
  needsPinSetup: boolean;
  deviceSecret?: string;
}

/** API response for `POST /auth/pin/verify` (step-up, feature 0010 §4.3/§6) AND
 * for `POST /auth/pin/reset` (forgot-PIN reset, §4.6/§12.6) — both mint a fresh
 * token pair (no SMS on verify) plus the ROTATED device secret for the BFF to
 * write back as a refreshed `__Host-fundi_dt` cookie. `deviceSecret` is server-
 * to-server only (stripped by the BFF), like `refreshToken`. */
export interface PinVerifyApiResult extends IssuedTokens {
  deviceSecret: string;
  memberships: MembershipDTO[];
}

/** API response for `POST /auth/pin/reset` — identical to the step-up result:
 * a fresh signed-in pair + rotated device secret + memberships (§4.6/§12.6). */
export type PinResetApiResult = PinVerifyApiResult;

/** API response for `POST /auth/pin/set` (feature 0010 §7.1). */
export interface SetPinApiResult {
  ok: true;
}

/** API response for `POST /auth/refresh`. */
export type RefreshApiResult = IssuedTokens;

/** API response for `POST /auth/onboarding`. */
export interface OnboardingApiResult {
  tokens: IssuedTokens;
  memberships: MembershipDTO[];
}

/** API response for `GET /auth/me`. `needsPinSetup` is live DB state
 * (`pinHash == null`), not a token claim, so the mandatory PIN-setup gate
 * (feature 0010 CHANGE 1) self-clears the instant a PIN is set. */
export interface MeApiResult {
  principal: Principal;
  memberships: MembershipDTO[];
  needsPinSetup: boolean;
}
