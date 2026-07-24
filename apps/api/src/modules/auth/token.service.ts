import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppClient } from '@prisma/client';
import type { MentorRole } from '@prisma/client';
import type { Principal } from '@fundi/types';
import { PrismaService } from '../../prisma';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_CLOCK_TOLERANCE_SECONDS,
  REFRESH_ABSOLUTE_TTL_SECONDS,
  REFRESH_IDLE_TIMEOUT_SECONDS,
  REFRESH_REUSE_GRACE_MS,
  REFRESH_TOKEN_BYTES,
} from './auth.constants';

/** The signed access-token claims (plan A.4). `org` is omitted for an org-less
 * onboarding token; everything else is always present. */
interface AccessClaims {
  sub: string;
  org?: string;
  role: MentorRole;
  app: AppClient;
}

/** A freshly minted refresh token: the opaque secret (returned once, to be set
 * as an httpOnly cookie by the BFF) plus its persisted metadata. */
export interface IssuedRefreshToken {
  token: string;
  familyId: string;
  expiresAt: Date;
}

/** The outcome of a successful rotation — enough for the caller to re-resolve
 * the active org and re-mint the access token. */
export interface RotatedRefreshToken extends IssuedRefreshToken {
  accountId: string;
  app: AppClient;
}

/**
 * Owns both token species:
 *  - **Access** — a short-lived HS256 JWT (`@nestjs/jwt`, pure JS) carrying the
 *    principal claims the org-context interceptor binds from.
 *  - **Refresh** — an opaque 32-byte secret stored only as a SHA-256 hash on
 *    `RefreshToken`, with family-based rotation + reuse detection (theft
 *    detection): replaying a revoked token revokes its whole family.
 *
 * `RefreshToken` is non-tenant-scoped, so the scoped Prisma client passes these
 * operations through untouched (they must work before any org context exists).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Sign an access JWT. Returns the token and its lifetime in seconds. `org`
   * is only included when the principal has an active organisation. */
  signAccessToken(principal: {
    accountId: string;
    org?: string;
    role: MentorRole;
    app: AppClient;
  }): { accessToken: string; expiresIn: number } {
    const claims: AccessClaims = {
      sub: principal.accountId,
      role: principal.role,
      app: principal.app,
      ...(principal.org ? { org: principal.org } : {}),
    };
    const accessToken = this.jwt.sign(claims, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  /** Verify an access JWT (with the agreed clock leeway) and shape it into a
   * {@link Principal}. Throws `UnauthorizedException` on any failure. */
  verifyAccessToken(token: string): Principal {
    let claims: AccessClaims & { exp?: number; iat?: number };
    try {
      claims = this.jwt.verify<AccessClaims>(token, {
        clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'invalid_token',
        message: 'Invalid or expired token.',
      });
    }
    return {
      accountId: claims.sub,
      role: claims.role,
      app: claims.app,
      ...(claims.org ? { org: claims.org } : {}),
    };
  }

  /** Mint a new refresh token. Starts a fresh family unless `familyId` is
   * supplied (rotation keeps the family).
   *
   * The absolute cap (feature 0010 §3) is anchored on `familyExpiresAt`: a NEW
   * family anchors it at `now + REFRESH_ABSOLUTE_TTL_SECONDS`; a rotation MUST
   * pass the existing family's anchor so it is carried forward UNCHANGED (never
   * `now + TTL`, or the cap slides and never trips). The per-row `expiresAt` is
   * set to that same anchor so there is exactly ONE cap mechanism — idle is
   * measured off `createdAt` in `rotateRefreshToken`, never off a second field. */
  async createRefreshToken(params: {
    accountId: string;
    app: AppClient;
    familyId?: string;
    familyExpiresAt?: Date;
  }): Promise<IssuedRefreshToken> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashToken(raw);
    // New family → anchor now; rotation → carry the family's anchor forward.
    const familyExpiresAt =
      params.familyExpiresAt ?? new Date(Date.now() + REFRESH_ABSOLUTE_TTL_SECONDS * 1000);
    // ONE cap mechanism: the per-row expiry IS the immutable family anchor.
    const expiresAt = familyExpiresAt;
    const row = await this.prisma.client.refreshToken.create({
      data: {
        accountId: params.accountId,
        app: params.app,
        // A new session starts a fresh family; rotation keeps the family id.
        familyId: params.familyId ?? randomUUID(),
        tokenHash,
        familyExpiresAt,
        expiresAt,
      },
    });
    return { token: raw, familyId: row.familyId, expiresAt };
  }

  /**
   * Rotate `rawToken`: revoke the presented row and mint a replacement in the
   * same family. Reuse detection: presenting an already-revoked token revokes
   * the *entire* family (theft) — EXCEPT within a short `REFRESH_REUSE_GRACE_MS`
   * window after a single legit rotation, which is treated as a benign
   * cross-tab/prefetch race (`invalid_grant`, no family/device revocation). A
   * benign concurrent-tab race that reaches the transaction — two rotations of
   * the same still-valid token — is likewise distinguished from theft: the loser
   * fails the atomic `revokedAt: null` guard and gets `invalid_grant` WITHOUT
   * tripping family revocation.
   *
   * The old single `expiresAt <= now` check is split into the two independent
   * re-auth clocks of feature 0010 §3, checked in order BEFORE the transaction:
   *   (a) idle    — `now − createdAt > REFRESH_IDLE_TIMEOUT_SECONDS` → `reauth_required`
   *   (b) absolute — `now > familyExpiresAt`                         → `session_expired`
   * Both send the user to a free PIN step-up (not OTP). Reuse/theft and the
   * concurrent-race loser keep returning `invalid_grant` (§6): the race loser
   * must silently retry, the theft victim must be forced to OTP. Detected theft
   * ALSO revokes the account's device trust for this app (§7.4) so the attacker
   * cannot PIN back in; the benign race must NOT touch device trust.
   */
  async rotateRefreshToken(rawToken: string): Promise<RotatedRefreshToken> {
    const tokenHash = this.hashToken(rawToken);
    const row = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } });

    if (!row) {
      throw this.invalidGrant('Unknown refresh token.');
    }

    const now = Date.now();
    if (row.revokedAt) {
      // The presented token was already rotated away. This is USUALLY theft — a
      // replay of a token we retired — and burns the whole family so a stolen
      // token cannot outlive its detection, plus revokes device trust so the
      // attacker cannot re-enter via PIN (§7.4).
      //
      // BUT a benign cross-tab/prefetch refresh race is indistinguishable from a
      // replay at the HTTP layer: two isolates each present the same still-valid
      // token microseconds apart, and the Edge single-flight cannot span the
      // Node BFF. To avoid logging a legitimate user out AND de-enrolling their
      // device over such a race, we tolerate a SMALL grace window (mirrors the
      // OAuth refresh-rotation grace pattern, and extends the same "benign race,
      // not theft" tolerance already applied to the in-transaction race loser
      // below). Treat it as a benign concurrent rotation — `invalid_grant`
      // WITHOUT family/device revocation — ONLY IF the token was revoked within
      // REFRESH_REUSE_GRACE_MS AND exactly one legitimate rotation happened: its
      // replacement row exists, is still live (`revokedAt == null`) and itself
      // un-rotated (`replacedById == null`). Otherwise (revoked longer ago, or
      // the replacement is itself already revoked/rotated — the true
      // reuse-after-detection signature) fall through to full revocation.
      //
      // Tradeoff: an attacker replaying a stolen token who happens to land inside
      // this sub-5s window immediately after a legit rotation escapes family
      // revocation on THAT call — vanishingly unlikely — but any reuse outside
      // the window still trips it. Device trust is NEVER revoked on the grace path.
      const replacement = row.replacedById
        ? await this.prisma.client.refreshToken.findUnique({ where: { id: row.replacedById } })
        : null;
      const withinGrace = now - row.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
      const oneLegitRotation =
        replacement != null && replacement.revokedAt == null && replacement.replacedById == null;
      if (withinGrace && oneLegitRotation) {
        throw this.invalidGrant('Refresh token already rotated — concurrent refresh.');
      }
      await this.revokeFamily(row.familyId);
      await this.revokeDeviceTrust(row.accountId, row.app);
      throw this.invalidGrant('Refresh token reuse detected — session revoked.');
    }

    // (a) Idle re-auth: the presented token's createdAt IS its last-activity
    // stamp (each rotation mints a fresh row), so idle = now − createdAt.
    if (now - row.createdAt.getTime() > REFRESH_IDLE_TIMEOUT_SECONDS * 1000) {
      throw this.reauthRequired();
    }
    // (b) Absolute cap: anchored at family birth, never extended. Null-tolerant
    // for backfilled rows (treat as createdAt + ABSOLUTE).
    const familyExpiresAt = this.resolveFamilyExpiresAt(row);
    if (now > familyExpiresAt.getTime()) {
      throw this.sessionExpired();
    }

    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const newHash = this.hashToken(raw);
    // Carry the immutable family anchor forward UNCHANGED; per-row expiry tracks it.
    const expiresAt = familyExpiresAt;

    return this.prisma.client.$transaction(async (tx) => {
      // Atomically claim the rotation: only the caller that flips revokedAt
      // from null wins. A concurrent rotation of the same row loses here
      // (count === 0) and is rejected without revoking the family.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw this.invalidGrant('Refresh token already rotated.');
      }
      const created = await tx.refreshToken.create({
        data: {
          accountId: row.accountId,
          app: row.app,
          familyId: row.familyId,
          tokenHash: newHash,
          familyExpiresAt,
          expiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { replacedById: created.id },
      });
      return {
        token: raw,
        familyId: row.familyId,
        expiresAt,
        accountId: row.accountId,
        app: row.app,
      };
    });
  }

  /** Revoke the token presented at logout and its whole family, so no sibling
   * token stays usable. Idempotent: an unknown token is a no-op. */
  async revokeByToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const row = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } });
    if (!row) {
      return;
    }
    await this.revokeFamily(row.familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke the account's device trust for this app on detected theft (§7.4).
   * Done via Prisma directly (not by injecting TrustedDeviceService) to avoid a
   * DI cycle. Only the reuse/theft branch calls this — never the benign race.
   */
  private async revokeDeviceTrust(accountId: string, app: AppClient): Promise<void> {
    await this.prisma.client.trustedDevice.updateMany({
      where: { accountId, app, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** The immutable absolute-cap anchor, tolerant of backfilled (null) rows:
   * a null `familyExpiresAt` is treated as `createdAt + REFRESH_ABSOLUTE_TTL`. */
  private resolveFamilyExpiresAt(row: {
    familyExpiresAt: Date | null;
    createdAt: Date;
  }): Date {
    return (
      row.familyExpiresAt ??
      new Date(row.createdAt.getTime() + REFRESH_ABSOLUTE_TTL_SECONDS * 1000)
    );
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private invalidGrant(message: string): UnauthorizedException {
    return new UnauthorizedException({ code: 'invalid_grant', message });
  }

  /** Idle clock tripped (§3): the session is valid but stale — step up with a
   * PIN. Distinct code so the BFF routes to `pin-entry`, not OTP. */
  private reauthRequired(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'reauth_required',
      message: 'Re-authentication required — please enter your PIN.',
    });
  }

  /** Absolute cap tripped (§3): the family is too old regardless of activity —
   * step up with a PIN. Distinct code so the BFF routes to `pin-entry`. */
  private sessionExpired(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'session_expired',
      message: 'Session expired — please enter your PIN.',
    });
  }
}
