import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AppClient, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { TrustedDeviceService } from './trusted-device.service';
import { TRUSTED_DEVICE_TTL_SECONDS } from './auth.constants';

/**
 * DB-backed suite for TrustedDeviceService (feature 0010 §5/§7.2). Follows the
 * repo skip idiom (auth.integration.test.ts): probe the DB in before(), skip at
 * runtime if it is unreachable or the identity tables are unmigrated, so the
 * suite is green locally without Docker and runs for real in CI.
 */

const PHONE_PREFIX = '+23324901';
const raw = new PrismaClient();
const prismaSvc = new PrismaService();
const svc = new TrustedDeviceService(prismaSvc);
let dbAvailable = false;

async function seedAccount(suffix: string): Promise<string> {
  const account = await raw.account.create({ data: { phone: `${PHONE_PREFIX}${suffix}` } });
  return account.id;
}

async function cleanup(): Promise<void> {
  const accounts = await raw.account.findMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  await raw.trustedDevice.deleteMany({ where: { accountId: { in: ids } } });
  await raw.account.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
}

before(async () => {
  try {
    await raw.$connect();
    await raw.trustedDevice.count();
    dbAvailable = true;
  } catch {
    console.warn('⚠ Skipping trusted-device integration test: no reachable/migrated Postgres.');
    return;
  }
  await cleanup();
});

after(async () => {
  if (dbAvailable) await cleanup();
  await raw.$disconnect();
  await prismaSvc.onModuleDestroy();
});

describe('TrustedDeviceService (0010 §5/§7.2)', () => {
  it('issue stores only the SHA-256, never the secret, and verifyCookie resolves it', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('0001');
    const { secret, id } = await svc.issue(accountId, AppClient.creator);

    const row = await raw.trustedDevice.findUnique({ where: { id } });
    assert.ok(row);
    assert.notEqual(row!.tokenHash, secret, 'the raw secret must never be stored');
    assert.equal(row!.tokenHash.length, 64, 'stored value is a hex sha256');

    const resolved = await svc.verifyCookie(secret, AppClient.creator);
    assert.equal(resolved?.id, id, 'a valid secret resolves to its row');
  });

  it('verifyCookie rejects the wrong app (a learner device is not a creator device)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('0002');
    const { secret } = await svc.issue(accountId, AppClient.learner);
    assert.equal(await svc.verifyCookie(secret, AppClient.creator), null);
    assert.ok(await svc.verifyCookie(secret, AppClient.learner));
  });

  it('verifyCookie rejects a revoked or expired device', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('0003');
    const revoked = await svc.issue(accountId, AppClient.creator);
    await svc.revokeById(revoked.id);
    assert.equal(await svc.verifyCookie(revoked.secret, AppClient.creator), null);

    const expired = await svc.issue(accountId, AppClient.creator);
    await raw.trustedDevice.update({
      where: { id: expired.id },
      data: { createdAt: new Date(Date.now() - (TRUSTED_DEVICE_TTL_SECONDS + 60) * 1000) },
    });
    assert.equal(await svc.verifyCookie(expired.secret, AppClient.creator), null);
  });

  it('rotateSecret invalidates the old secret and returns a working new one', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('0004');
    const { secret: oldSecret, id } = await svc.issue(accountId, AppClient.creator);
    const row = await raw.trustedDevice.findUnique({ where: { id } });
    const { secret: newSecret } = await svc.rotateSecret(row!);

    assert.notEqual(newSecret, oldSecret);
    assert.equal(
      await svc.verifyCookie(oldSecret, AppClient.creator),
      null,
      'a copied (old) cookie is caught after rotation',
    );
    assert.equal((await svc.verifyCookie(newSecret, AppClient.creator))?.id, id);
  });

  it('revoke clears all live rows for the account+app', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('0005');
    const a = await svc.issue(accountId, AppClient.creator);
    const b = await svc.issue(accountId, AppClient.creator);
    await svc.revoke(accountId, AppClient.creator);
    assert.equal(await svc.verifyCookie(a.secret, AppClient.creator), null);
    assert.equal(await svc.verifyCookie(b.secret, AppClient.creator), null);
  });
});
