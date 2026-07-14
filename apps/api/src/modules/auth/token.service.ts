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
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_SECONDS,
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
   * supplied (rotation keeps the family). */
  async createRefreshToken(params: {
    accountId: string;
    app: AppClient;
    familyId?: string;
  }): Promise<IssuedRefreshToken> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const row = await this.prisma.client.refreshToken.create({
      data: {
        accountId: params.accountId,
        app: params.app,
        // A new session starts a fresh family; rotation keeps the family id.
        familyId: params.familyId ?? randomUUID(),
        tokenHash,
        expiresAt,
      },
    });
    return { token: raw, familyId: row.familyId, expiresAt };
  }

  /**
   * Rotate `rawToken`: revoke the presented row and mint a replacement in the
   * same family. Reuse detection: presenting an already-revoked token revokes
   * the *entire* family (theft). A benign concurrent-tab race — two rotations
   * of the same still-valid token — is distinguished from theft: the loser
   * fails the atomic `revokedAt: null` guard and gets `invalid_grant` WITHOUT
   * tripping family revocation.
   */
  async rotateRefreshToken(rawToken: string): Promise<RotatedRefreshToken> {
    const tokenHash = this.hashToken(rawToken);
    const row = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } });

    if (!row) {
      throw this.invalidGrant('Unknown refresh token.');
    }
    if (row.revokedAt) {
      // Reuse of a token we already rotated away — treat as theft and burn the
      // whole family so a stolen token cannot outlive its detection.
      await this.revokeFamily(row.familyId);
      throw this.invalidGrant('Refresh token reuse detected — session revoked.');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      throw this.invalidGrant('Refresh token expired.');
    }

    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const newHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

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

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private invalidGrant(message: string): UnauthorizedException {
    return new UnauthorizedException({ code: 'invalid_grant', message });
  }
}
