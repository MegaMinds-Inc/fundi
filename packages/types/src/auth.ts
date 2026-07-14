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
