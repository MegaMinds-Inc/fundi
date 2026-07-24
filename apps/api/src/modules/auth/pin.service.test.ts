import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import type { TrustedDevice } from '@prisma/client';
import type { PrismaService } from '../../prisma';
import { PinService } from './pin.service';
import { PIN_LOCKOUT_BACKOFF_SECONDS, PIN_MAX_ATTEMPTS } from './auth.constants';

/**
 * Pure unit test for PinService (feature 0010 §7.1/7.3/7.5). Uses a tiny
 * in-memory Prisma fake so the scrypt+HMAC path, the pepper, the constant-time
 * decoy, and the per-device lockout are exercised deterministically without a
 * DB. Real node:crypto runs — only the persistence is faked.
 */

// A fixed pepper for the suite (resolved at hash time, so set before any call).
process.env.PIN_PEPPER = process.env.PIN_PEPPER ?? 'unit-test-pin-pepper';

interface AccountRow {
  pinHash: string | null;
  pinSalt: string | null;
}

/** Build a PinService over an in-memory store of accounts + devices. */
function makeService(): {
  svc: PinService;
  accounts: Map<string, AccountRow>;
  devices: Map<string, TrustedDevice>;
} {
  const accounts = new Map<string, AccountRow>();
  const devices = new Map<string, TrustedDevice>();
  const prisma = {
    client: {
      account: {
        findUnique: async ({ where }: { where: { id: string } }) => accounts.get(where.id) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Partial<AccountRow> }) => {
          const row = accounts.get(where.id) ?? { pinHash: null, pinSalt: null };
          Object.assign(row, data);
          accounts.set(where.id, row);
          return row;
        },
      },
      trustedDevice: {
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<TrustedDevice>;
        }) => {
          const row = devices.get(where.id)!;
          Object.assign(row, data);
          return row;
        },
      },
    },
  } as unknown as PrismaService;
  return { svc: new PinService(prisma), accounts, devices };
}

function makeDevice(over: Partial<TrustedDevice> = {}): TrustedDevice {
  return {
    id: 'dev_1',
    accountId: 'acct_1',
    app: 'creator',
    tokenHash: 'h',
    pinAttempts: 0,
    pinLockedUntil: null,
    revokedAt: null,
    createdAt: new Date(),
    ...over,
  } as TrustedDevice;
}

const GOOD_PIN = '284659';

describe('PinService — hashing + pepper', () => {
  it('is deterministic for the same pin+salt, and salt-sensitive', async () => {
    const { svc } = makeService();
    const a = await svc.hashPin(GOOD_PIN, 'salt-a');
    const b = await svc.hashPin(GOOD_PIN, 'salt-a');
    const c = await svc.hashPin(GOOD_PIN, 'salt-b');
    assert.equal(a, b, 'same inputs → same hash');
    assert.notEqual(a, c, 'a different salt must change the hash');
  });

  it('depends on the pepper (a DB-only leak yields nothing crackable)', async () => {
    const { svc } = makeService();
    const withDefault = await svc.hashPin(GOOD_PIN, 'salt');
    process.env.PIN_PEPPER = 'a-different-pepper';
    const withOther = await svc.hashPin(GOOD_PIN, 'salt');
    process.env.PIN_PEPPER = 'unit-test-pin-pepper';
    assert.notEqual(withDefault, withOther, 'changing the pepper must change the hash');
  });
});

describe('PinService — setPin validation (§7.3)', () => {
  it('rejects a too-short PIN', async () => {
    const { svc } = makeService();
    await assert.rejects(
      () => svc.setPin('acct_1', '12345'),
      (e: unknown) =>
        e instanceof HttpException && (e.getResponse() as { code?: string }).code === 'pin_invalid',
    );
  });

  it('rejects a weak PIN via the blocklist', async () => {
    const { svc } = makeService();
    await assert.rejects(
      () => svc.setPin('acct_1', '123456'),
      (e: unknown) =>
        e instanceof HttpException && (e.getResponse() as { code?: string }).code === 'weak_pin',
    );
  });

  it('stores a hash+salt for a strong PIN (never the PIN itself)', async () => {
    const { svc, accounts } = makeService();
    await svc.setPin('acct_1', GOOD_PIN);
    const row = accounts.get('acct_1')!;
    assert.ok(row.pinHash && row.pinSalt, 'hash and salt must be persisted');
    assert.notEqual(row.pinHash, GOOD_PIN, 'the PIN must never be stored in the clear');
  });
});

describe('PinService — verifyPin round-trip + lockout + decoy (§7.5)', () => {
  it('round-trips: a PIN set then verified returns ok and resets counters', async () => {
    const { svc, accounts, devices } = makeService();
    await svc.setPin('acct_1', GOOD_PIN);
    const device = makeDevice({ accountId: 'acct_1', pinAttempts: 3 });
    devices.set(device.id, device);
    // account row was created by setPin under the fake
    assert.ok(accounts.get('acct_1')?.pinHash);

    const result = await svc.verifyPin(device, GOOD_PIN);
    assert.deepEqual(result, { ok: true });
    assert.equal(device.pinAttempts, 0, 'success resets the attempt counter');
    assert.equal(device.pinLockedUntil, null);
  });

  it('increments attempts on a wrong PIN and locks with escalating backoff', async () => {
    const { svc, devices } = makeService();
    await svc.setPin('acct_1', GOOD_PIN);
    const device = makeDevice({ accountId: 'acct_1' });
    devices.set(device.id, device);

    // Wrong guesses up to (but not at) the cap → invalid, counter climbs.
    for (let i = 1; i < PIN_MAX_ATTEMPTS; i += 1) {
      const r = await svc.verifyPin(device, '111111');
      assert.deepEqual(r, { ok: false, reason: 'invalid' });
      assert.equal(device.pinAttempts, i);
      assert.equal(device.pinLockedUntil, null, 'not locked before the cap');
    }

    // The cap-hitting guess locks with the first backoff tier.
    const locked = await svc.verifyPin(device, '111111');
    assert.deepEqual(locked, { ok: false, reason: 'locked' });
    assert.equal(device.pinAttempts, PIN_MAX_ATTEMPTS);
    assert.ok(device.pinLockedUntil, 'lockout armed at the cap');
    const firstWindowMs = device.pinLockedUntil!.getTime() - Date.now();
    assert.ok(
      firstWindowMs > (PIN_LOCKOUT_BACKOFF_SECONDS[0] - 5) * 1000 &&
        firstWindowMs <= PIN_LOCKOUT_BACKOFF_SECONDS[0] * 1000,
      'first lockout uses backoff tier 0 (30s)',
    );
  });

  it('is a live lockout: further guesses while locked short-circuit to locked', async () => {
    const { svc, devices } = makeService();
    await svc.setPin('acct_1', GOOD_PIN);
    const device = makeDevice({
      accountId: 'acct_1',
      pinAttempts: PIN_MAX_ATTEMPTS,
      pinLockedUntil: new Date(Date.now() + 60_000),
    });
    devices.set(device.id, device);
    // Even the CORRECT pin is refused while the backoff is live.
    const r = await svc.verifyPin(device, GOOD_PIN);
    assert.deepEqual(r, { ok: false, reason: 'locked' });
    assert.equal(device.pinAttempts, PIN_MAX_ATTEMPTS, 'a locked call does not increment');
  });

  it('self-heals: once the lockout expires a correct PIN succeeds and resets', async () => {
    const { svc, devices } = makeService();
    await svc.setPin('acct_1', GOOD_PIN);
    const device = makeDevice({
      accountId: 'acct_1',
      pinAttempts: PIN_MAX_ATTEMPTS,
      pinLockedUntil: new Date(Date.now() - 1000), // already elapsed
    });
    devices.set(device.id, device);
    const r = await svc.verifyPin(device, GOOD_PIN);
    assert.deepEqual(r, { ok: true });
    assert.equal(device.pinAttempts, 0);
    assert.equal(device.pinLockedUntil, null);
  });

  it('escalates the backoff on a wrong guess after a healed lockout', async () => {
    const { svc, devices } = makeService();
    await svc.setPin('acct_1', GOOD_PIN);
    const device = makeDevice({
      accountId: 'acct_1',
      pinAttempts: PIN_MAX_ATTEMPTS, // already had one lockout
      pinLockedUntil: new Date(Date.now() - 1000), // healed
    });
    devices.set(device.id, device);
    const r = await svc.verifyPin(device, '111111'); // wrong again → attempts = 6
    assert.deepEqual(r, { ok: false, reason: 'locked' });
    assert.equal(device.pinAttempts, PIN_MAX_ATTEMPTS + 1);
    const windowMs = device.pinLockedUntil!.getTime() - Date.now();
    assert.ok(
      windowMs > (PIN_LOCKOUT_BACKOFF_SECONDS[1] - 5) * 1000 &&
        windowMs <= PIN_LOCKOUT_BACKOFF_SECONDS[1] * 1000,
      'second lockout escalates to backoff tier 1 (120s)',
    );
  });

  it('runs a decoy and fails uniformly when the account has no PIN (no oracle)', async () => {
    const { svc, accounts, devices } = makeService();
    accounts.set('acct_1', { pinHash: null, pinSalt: null }); // enrolled device, no PIN yet
    const device = makeDevice({ accountId: 'acct_1' });
    devices.set(device.id, device);
    const r = await svc.verifyPin(device, GOOD_PIN);
    assert.deepEqual(r, { ok: false, reason: 'invalid' }, 'no-PIN must look like a wrong PIN');
  });

  it('fails uniformly when the account row is missing entirely', async () => {
    const { svc, devices } = makeService();
    const device = makeDevice({ accountId: 'ghost' });
    devices.set(device.id, device);
    const r = await svc.verifyPin(device, GOOD_PIN);
    assert.deepEqual(r, { ok: false, reason: 'invalid' });
  });
});
