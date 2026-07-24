import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AppClient, TrustedDevice } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { REFRESH_TOKEN_BYTES, TRUSTED_DEVICE_TTL_SECONDS } from './auth.constants';

/** A freshly issued (or rotated) device secret: the opaque value (returned once,
 * to be written as a `__Host-` httpOnly Secure SameSite=Strict cookie by the
 * BFF in Wave 3) plus the row id. Only the SHA-256 is persisted. */
export interface IssuedTrustedDevice {
  secret: string;
  id: string;
}

/**
 * Owns the trusted-device credential (feature 0010 §5/§7.2). A device is trusted
 * by holding a high-entropy random secret whose SHA-256 alone is stored on a
 * `TrustedDevice` row (exactly the refresh-token construction — never the secret
 * itself, never a signature-over-payload, never a spoofable fingerprint).
 * Presence + hash-match = "this device proved phone ownership; skip OTP, a PIN
 * is enough." The secret is rotated on every successful step-up so a copied
 * cookie is caught by reuse on its next use.
 */
@Injectable()
export class TrustedDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Enroll a device for `accountId`/`app`: mint a 32-byte secret, store only
   * its hash, and hand back the secret once for the BFF to set as a cookie. */
  async issue(accountId: string, app: AppClient): Promise<IssuedTrustedDevice> {
    const secret = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashSecret(secret);
    const row = await this.prisma.client.trustedDevice.create({
      data: { accountId, app, tokenHash },
    });
    return { secret, id: row.id };
  }

  /**
   * Resolve a presented device-cookie `secret` to its live row, or `null`.
   * Rejects a missing / revoked / expired (older than `TRUSTED_DEVICE_TTL`) row
   * and one enrolled for a different `app` (so a learner device can never stand
   * in for a creator one). Returns the row so the caller can derive
   * `accountId`/`app` from it rather than trusting anything client-supplied.
   */
  async verifyCookie(secret: string, app: AppClient): Promise<TrustedDevice | null> {
    const tokenHash = this.hashSecret(secret);
    const row = await this.prisma.client.trustedDevice.findUnique({ where: { tokenHash } });
    if (!row || row.revokedAt || row.app !== app) {
      return null;
    }
    const ageMs = Date.now() - row.createdAt.getTime();
    if (ageMs > TRUSTED_DEVICE_TTL_SECONDS * 1000) {
      return null;
    }
    return row;
  }

  /**
   * Rotate the secret on an existing row (call on every successful step-up).
   * The old hash stops matching immediately, so a copied cookie fails its next
   * `verifyCookie` — the same reuse-detection benefit refresh rotation gives.
   */
  async rotateSecret(row: TrustedDevice): Promise<IssuedTrustedDevice> {
    const secret = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashSecret(secret);
    await this.prisma.client.trustedDevice.update({
      where: { id: row.id },
      data: { tokenHash },
    });
    return { secret, id: row.id };
  }

  /** Revoke every live device row for the account+app (logout / theft / forget). */
  async revoke(accountId: string, app: AppClient): Promise<void> {
    await this.prisma.client.trustedDevice.updateMany({
      where: { accountId, app, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke a single device row by id (backs the "Not you?" device-forget action). */
  async revokeById(id: string): Promise<void> {
    await this.prisma.client.trustedDevice.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
