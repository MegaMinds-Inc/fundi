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
 * {@link IssuedTokens}; the shape still satisfies the shared `VerifyOtpResult`. */
export interface VerifyOtpApiResult {
  tokens?: IssuedTokens;
  needsOnboarding: boolean;
  memberships: MembershipDTO[];
}

/** API response for `POST /auth/refresh`. */
export type RefreshApiResult = IssuedTokens;

/** API response for `POST /auth/onboarding`. */
export interface OnboardingApiResult {
  tokens: IssuedTokens;
  memberships: MembershipDTO[];
}

/** API response for `GET /auth/me`. */
export interface MeApiResult {
  principal: Principal;
  memberships: MembershipDTO[];
}
