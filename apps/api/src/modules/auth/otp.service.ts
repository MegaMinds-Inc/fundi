import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import {
  OTP_CODE_LENGTH,
  OTP_ISSUANCE_CAP,
  OTP_ISSUANCE_WINDOW_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SCRYPT_KEYLEN,
  OTP_TTL_MS,
} from './auth.constants';
import { OtpDeliveryService } from './otp-delivery.service';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/**
 * Fixed dummy inputs for the decoy hash on the no-challenge path (feature 0010
 * §7.5). The values are irrelevant — they only have to be stable so the KDF
 * work is real and the "no unconsumed challenge" branch costs the same time as
 * a genuine wrong-code compare, closing the timing oracle.
 */
const OTP_DECOY_SALT = 'fundi-otp-decoy-salt-0010';
const OTP_DECOY_CODE = '000000';

/**
 * Owns the one-time-code lifecycle on `OtpChallenge`: issuance (with per-phone
 * cooldown + rolling cap), and verification (with an attempt cap, expiry, and
 * single-use consumption for replay protection). Codes are never stored in the
 * clear — only a scrypt hash over a per-row salt (pre-decided: node:crypto,
 * no native argon2/bcrypt). `OtpChallenge` is non-tenant-scoped, so the scoped
 * Prisma client passes these operations through untouched (readable pre-auth).
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: OtpDeliveryService,
  ) {}

  /**
   * Issue a fresh challenge for `phone` and dispatch it. Enforces the resend
   * cooldown and the rolling issuance cap (both `429`); returns nothing on
   * success so the caller can respond with an enumeration-safe `204`.
   */
  async request(phone: string): Promise<void> {
    const now = Date.now();

    const mostRecent = await this.prisma.client.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (mostRecent) {
      const sinceLast = now - mostRecent.createdAt.getTime();
      if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
        throw new HttpException(
          {
            code: 'otp_cooldown',
            message: 'Please wait before requesting another code.',
            retryAfterMs: OTP_RESEND_COOLDOWN_MS - sinceLast,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const windowStart = new Date(now - OTP_ISSUANCE_WINDOW_MS);
    const issuedInWindow = await this.prisma.client.otpChallenge.count({
      where: { phone, createdAt: { gte: windowStart } },
    });
    if (issuedInWindow >= OTP_ISSUANCE_CAP) {
      throw new HttpException(
        {
          code: 'otp_rate_limited',
          message: 'Too many codes requested. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const salt = randomBytes(16).toString('hex');
    const codeHash = await this.hash(code, salt);

    await this.prisma.client.otpChallenge.create({
      data: {
        phone,
        codeHash,
        salt,
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    });

    await this.delivery.send(phone, code);
  }

  /**
   * Verify `code` against the active challenge for `phone`. On success the
   * challenge is consumed (single-use). Failures throw a `401` carrying a
   * distinct `code` (`otp_invalid` / `otp_expired` / `otp_locked`) so the UI
   * can show the right state (wrong vs expired vs locked) rather than a generic
   * error.
   */
  async verify(phone: string, code: string): Promise<void> {
    const challenge = await this.prisma.client.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      // No unconsumed challenge — either never requested, or already used
      // (replay). Indistinguishable on purpose. Run a constant-time decoy hash
      // first so this path costs the same as a real compare (no timing oracle
      // that leaks whether a challenge exists — feature 0010 §7.5).
      await this.decoyHash();
      throw this.reject('otp_invalid', 'That code is not valid. Request a new one.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw this.reject('otp_expired', 'That code has expired. Request a new one.');
    }

    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw this.reject('otp_locked', 'Too many attempts. Request a new code.');
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(await this.hash(code, challenge.salt), 'hex');
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const attempts = challenge.attempts + 1;
      await this.prisma.client.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts },
      });
      if (attempts >= OTP_MAX_ATTEMPTS) {
        throw this.reject('otp_locked', 'Too many attempts. Request a new code.');
      }
      throw this.reject('otp_invalid', 'That code is incorrect. Try again.');
    }

    await this.prisma.client.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < OTP_CODE_LENGTH; i += 1) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }

  private async hash(code: string, salt: string): Promise<string> {
    const derived = await scrypt(code, salt, OTP_SCRYPT_KEYLEN);
    return derived.toString('hex');
  }

  /** Burn a real scrypt + constant-time compare with no observable result, so
   * the no-challenge path is latency-indistinguishable from a real verify. */
  private async decoyHash(): Promise<void> {
    const actual = Buffer.from(await this.hash(OTP_DECOY_CODE, OTP_DECOY_SALT), 'hex');
    const dummy = Buffer.alloc(actual.length);
    timingSafeEqual(actual, dummy);
  }

  private reject(code: string, message: string): HttpException {
    return new HttpException({ code, message }, HttpStatus.UNAUTHORIZED);
  }
}
