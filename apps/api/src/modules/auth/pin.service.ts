import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { TrustedDevice } from '@prisma/client';
import { PrismaService } from '../../prisma';
import {
  PIN_LENGTH_MAX,
  PIN_LENGTH_MIN,
  PIN_LOCKOUT_BACKOFF_SECONDS,
  PIN_MAX_ATTEMPTS,
  PIN_SCRYPT_KEYLEN,
  resolvePinPepper,
} from './auth.constants';
import { isWeakPin } from './weak-pins';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/**
 * A fixed dummy salt used only by the decoy path so a verify against an account
 * with no PIN (or a mismatched device) still pays the full scrypt+HMAC cost and
 * cannot be told apart by latency from a real wrong-PIN compare (§7.5). The
 * value is irrelevant — it only has to be stable so the work is real.
 */
const DECOY_SALT = 'fundi-pin-decoy-salt-0010';
const DECOY_PIN = '000000';

/** The structured outcome of a PIN verify. The orchestrator (Wave 3) branches
 * on this for the attempt counter / lockout routing, but the HTTP layer MUST
 * collapse every non-`ok` case to a single uniform error (no existence oracle,
 * §7.5) — the `reason` is internal only. */
export type PinVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'locked' };

/**
 * Owns the PIN step-up credential (feature 0010 §7.1/7.3/7.5). The PIN lives on
 * `Account` as `pinHash`/`pinSalt`: scrypt over a per-row salt (mirroring
 * `OtpService`), then HMAC-SHA256'd with a server-side pepper held OUTSIDE the
 * DB (`resolvePinPepper`) so a DB-only leak yields nothing offline-crackable.
 * Wrong-PIN lockout is tracked PER DEVICE on the `TrustedDevice` row (an abused
 * device can never lock the whole identity, nor auto-force an SMS). A PIN, its
 * hash, and the pepper are never logged.
 */
@Injectable()
export class PinService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derive the stored credential for `pin` under `salt`: scrypt (slow KDF),
   * then HMAC-SHA256 with the pepper as the key. The pepper being the HMAC key
   * (not concatenated into the KDF input) is what keeps it out of any offline
   * attack that only has the DB. Returns lowercase hex.
   */
  async hashPin(pin: string, salt: string): Promise<string> {
    const derived = await scrypt(pin, salt, PIN_SCRYPT_KEYLEN);
    return createHmac('sha256', resolvePinPepper()).update(derived).digest('hex');
  }

  /**
   * Set (or overwrite) the account's PIN. Validates length `[MIN, MAX]` and
   * rejects structurally-weak PINs via the blocklist (§7.3), mints a fresh
   * per-row salt, and stores `pinHash`/`pinSalt`. This method only sets — the
   * first-set-vs-replace policy (§7.1) is enforced by the orchestrator (Wave 3).
   */
  async setPin(accountId: string, pin: string): Promise<void> {
    this.assertPinAcceptable(pin);
    const salt = randomBytes(16).toString('hex');
    const pinHash = await this.hashPin(pin, salt);
    await this.prisma.client.account.update({
      where: { id: accountId },
      data: { pinHash, pinSalt: salt },
    });
  }

  /**
   * Verify `pin` for the holder of `device` (a valid, already-resolved
   * `TrustedDevice` row — the cookie gate lives upstream). Enforces the
   * per-device lockout, constant-time compares the stored hash, and runs a
   * decoy hash when there is no credential so every miss costs the same time
   * and reveals nothing (§7.5). Never throws for a wrong PIN — returns a
   * structured result the orchestrator maps to one uniform HTTP error.
   */
  async verifyPin(device: TrustedDevice, pin: string): Promise<PinVerifyResult> {
    const now = Date.now();

    // Per-device lockout: a live backoff short-circuits before any hashing.
    if (device.pinLockedUntil && device.pinLockedUntil.getTime() > now) {
      return { ok: false, reason: 'locked' };
    }

    const account = await this.prisma.client.account.findUnique({
      where: { id: device.accountId },
      select: { pinHash: true, pinSalt: true },
    });

    // No account or no PIN set → still pay the full KDF cost, then fail
    // uniformly. Never leak whether a credential exists (§7.5).
    if (!account || !account.pinHash || !account.pinSalt) {
      await this.runDecoy();
      return { ok: false, reason: 'invalid' };
    }

    const expected = Buffer.from(account.pinHash, 'hex');
    const actual = Buffer.from(await this.hashPin(pin, account.pinSalt), 'hex');
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      return this.registerFailure(device);
    }

    // Success: clear the per-device attempt counter and any lockout.
    await this.prisma.client.trustedDevice.update({
      where: { id: device.id },
      data: { pinAttempts: 0, pinLockedUntil: null },
    });
    return { ok: true };
  }

  /** Length + blocklist gate for a candidate PIN (§7.3). Throws a typed
   * `HttpException` the controller maps; the message never echoes the PIN. */
  private assertPinAcceptable(pin: string): void {
    if (!/^\d+$/.test(pin) || pin.length < PIN_LENGTH_MIN || pin.length > PIN_LENGTH_MAX) {
      throw new HttpException(
        {
          code: 'pin_invalid',
          message: `PIN must be ${PIN_LENGTH_MIN} digits.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (isWeakPin(pin)) {
      throw new HttpException(
        {
          code: 'weak_pin',
          message: 'Pick something harder to guess.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  /**
   * Record a wrong-PIN attempt on the device and, at the cap, arm the escalating
   * self-healing backoff (§7.5). The tier climbs with each attempt past the cap
   * (each subsequent try only happens after a prior lockout has healed), so the
   * backoff steps 30s → 120s → 600s and then holds. A success later resets it.
   */
  private async registerFailure(device: TrustedDevice): Promise<PinVerifyResult> {
    const attempts = device.pinAttempts + 1;
    const data: { pinAttempts: number; pinLockedUntil?: Date } = { pinAttempts: attempts };

    let locked = false;
    if (attempts >= PIN_MAX_ATTEMPTS) {
      locked = true;
      const tier = attempts - PIN_MAX_ATTEMPTS; // 0 at the first lockout, then climbs
      const idx = Math.min(tier, PIN_LOCKOUT_BACKOFF_SECONDS.length - 1);
      const backoffSeconds = PIN_LOCKOUT_BACKOFF_SECONDS[idx];
      data.pinLockedUntil = new Date(Date.now() + backoffSeconds * 1000);
    }

    await this.prisma.client.trustedDevice.update({
      where: { id: device.id },
      data,
    });
    return { ok: false, reason: locked ? 'locked' : 'invalid' };
  }

  /** Burn a real scrypt+HMAC + constant-time compare with no observable result,
   * so the no-credential path is latency-indistinguishable from a real compare. */
  private async runDecoy(): Promise<void> {
    const actual = Buffer.from(await this.hashPin(DECOY_PIN, DECOY_SALT), 'hex');
    // Compare against a same-length zero buffer purely to spend the compare time.
    const dummy = Buffer.alloc(actual.length);
    timingSafeEqual(actual, dummy);
  }
}
