import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppClient, PrismaClient } from '@prisma/client';
import type { Principal } from '@fundi/types';
import { PrismaModule } from '../../prisma';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { PhoneService } from './phone.service';
import { TokenService } from './token.service';
import { TrustedDeviceService } from './trusted-device.service';
import { OtpDeliveryService, StubOtpDeliveryService } from './otp-delivery.service';
import type { VerifyOtpApiResult } from './auth.responses';
import {
  OTP_RESEND_COOLDOWN_MS,
  REFRESH_ABSOLUTE_TTL_SECONDS,
  REFRESH_IDLE_TIMEOUT_SECONDS,
} from './auth.constants';

/**
 * Wave-3 integration suite for feature 0010 (device trust + PIN step-up). Follows
 * the repo skip idiom (auth.integration.test.ts): probe the DB in before(), skip
 * at runtime if it is unreachable / unmigrated, so `pnpm test` is green locally
 * without Docker and runs for real in CI.
 *
 * DETERMINISM: the local `.env` sets OTP_DELIVERY_DRIVER=sms (concurrent 0009
 * work), which would break the stub `lastCodeFor` helper. This suite forces the
 * STUB driver two ways — the env var (set before the module compiles) AND an
 * explicit provider override — so OTP-dependent assertions are deterministic
 * regardless of the ambient env.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret';
process.env.PIN_PEPPER = process.env.PIN_PEPPER ?? 'integration-test-pin-pepper';
process.env.OTP_DELIVERY_DRIVER = 'stub';

const PHONE_PREFIX = '+23324902';

const raw = new PrismaClient();
let app: INestApplication;
let dbAvailable = false;

let auth: AuthService;
let tokens: TokenService;
let phoneSvc: PhoneService;
let devices: TrustedDeviceService;
let delivery: StubOtpDeliveryService;

/** Enroll a fresh session for `phone`/`app`, aging any prior challenge past the
 * resend cooldown first so the same identity can log in twice. */
async function enroll(phoneInput: string, appClient: AppClient): Promise<VerifyOtpApiResult> {
  const normalized = phoneSvc.normalize(phoneInput);
  await raw.otpChallenge.updateMany({
    where: { phone: normalized },
    data: { createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000) },
  });
  await auth.requestOtp(phoneInput);
  const code = delivery.lastCodeFor(normalized);
  assert.ok(code, `expected a delivered code for ${normalized}`);
  return auth.verifyOtp(phoneInput, code, appClient);
}

function principalOf(result: VerifyOtpApiResult): Principal {
  assert.ok(result.tokens);
  return tokens.verifyAccessToken(result.tokens.accessToken);
}

async function cleanup(): Promise<void> {
  const accounts = await raw.account.findMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  await raw.trustedDevice.deleteMany({ where: { accountId: { in: ids } } });
  await raw.refreshToken.deleteMany({ where: { accountId: { in: ids } } });
  await raw.membership.deleteMany({ where: { accountId: { in: ids } } });
  await raw.otpChallenge.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await raw.account.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
}

before(async () => {
  try {
    await raw.$connect();
    await raw.$queryRaw`SELECT 1`;
    await raw.trustedDevice.count();
    dbAvailable = true;
  } catch {
    console.warn('⚠ Skipping pin-step-up integration test: no reachable/migrated Postgres.');
    return;
  }
  await cleanup();
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule],
  })
    // Force the in-memory stub regardless of the ambient OTP_DELIVERY_DRIVER.
    .overrideProvider(OtpDeliveryService)
    .useClass(StubOtpDeliveryService)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  auth = app.get(AuthService);
  tokens = app.get(TokenService);
  phoneSvc = app.get(PhoneService);
  devices = app.get(TrustedDeviceService);
  delivery = app.get(OtpDeliveryService) as StubOtpDeliveryService;
});

after(async () => {
  if (dbAvailable) {
    await cleanup();
    await app.close();
  }
  await raw.$disconnect();
  delete process.env.SMS_DAILY_BUDGET;
});

describe('Enrollment mints device trust (0010 §6)', () => {
  it('verifyOtp issues a device secret and flags needsPinSetup for a new account', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0001`, AppClient.creator);
    assert.ok(result.deviceSecret, 'enrollment must return a device secret');
    assert.equal(result.needsPinSetup, true, 'a brand-new account has no PIN yet');
    const resolved = await devices.verifyCookie(result.deviceSecret!, AppClient.creator);
    assert.ok(resolved, 'the returned secret must resolve to a live device row');
  });
});

describe('pin/set — first-set vs replace (0010 §7.1)', () => {
  it('first-set is allowed on session auth alone (no proof)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0002`, AppClient.creator);
    const principal = principalOf(result);
    const out = await auth.setPin(principal, '835274');
    assert.deepEqual(out, { ok: true });
    const account = await raw.account.findUnique({ where: { id: principal.accountId } });
    assert.ok(account?.pinHash, 'the PIN hash must be stored');
    assert.ok(account?.pinSalt, 'a per-row salt must be stored');
  });

  it('replace WITHOUT proof is rejected 403 pin_change_requires_proof', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0003`, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, '835274'); // first-set OK
    await assert.rejects(
      () => auth.setPin(principal, '624839'), // replace, no proof
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 403 &&
        (e.getResponse() as { code?: string }).code === 'pin_change_requires_proof',
    );
    // The stored PIN is unchanged (still verifies as the original).
    const device = await devices.issue(principal.accountId, AppClient.creator);
    const check = await devices.verifyCookie(device.secret, AppClient.creator);
    assert.ok(check);
  });

  it('replace WITH the current-PIN proof succeeds and revokes OTHER families', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0004`, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, '835274');
    const beforeHash = (await raw.account.findUnique({ where: { id: principal.accountId } }))
      ?.pinHash;

    // The caller's current session family (kept) + a second family (revoked).
    const keep = await tokens.createRefreshToken({
      accountId: principal.accountId,
      app: AppClient.creator,
    });
    const other = await tokens.createRefreshToken({
      accountId: principal.accountId,
      app: AppClient.creator,
    });

    const out = await auth.setPin(principal, '624839', { currentPin: '835274' }, keep.token);
    assert.deepEqual(out, { ok: true });

    const afterHash = (await raw.account.findUnique({ where: { id: principal.accountId } }))
      ?.pinHash;
    assert.notEqual(afterHash, beforeHash, 'the stored PIN hash must change on replace');

    const keptRow = await raw.refreshToken.findFirst({ where: { familyId: keep.familyId } });
    const otherRow = await raw.refreshToken.findFirst({ where: { familyId: other.familyId } });
    assert.equal(keptRow?.revokedAt, null, "the caller's current family stays live");
    assert.ok(otherRow?.revokedAt, 'every OTHER family is revoked (compromise hygiene)');
  });

  it('replace WITH a fresh OTP proof succeeds', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}0005`;
    const result = await enroll(phone, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, '835274');

    // Issue a fresh OTP for the account phone (age the enrollment challenge first).
    const normalized = phoneSvc.normalize(phone);
    await raw.otpChallenge.updateMany({
      where: { phone: normalized },
      data: { createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000) },
    });
    await auth.requestOtp(phone);
    const otpCode = delivery.lastCodeFor(normalized)!;

    const out = await auth.setPin(principal, '624839', { otpCode });
    assert.deepEqual(out, { ok: true });
  });
});

describe('pin/verify — device + PIN step-up (0010 §4.3/§7.5)', () => {
  it('good device + PIN mints a FRESH pair, no SMS, and rotates the device cookie', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0006`, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, '835274');
    const deviceSecret = result.deviceSecret!;

    const sentBefore = delivery.sent.length;
    const stepped = await auth.stepUpWithPin(deviceSecret, AppClient.creator, '835274');

    assert.ok(stepped.accessToken, 'step-up mints a fresh access token');
    assert.ok(stepped.refreshToken, 'step-up mints a fresh refresh token');
    assert.equal(delivery.sent.length, sentBefore, 'step-up must NOT send an SMS');
    assert.notEqual(stepped.deviceSecret, deviceSecret, 'the device secret must rotate');

    // The old (pre-rotation) secret is now dead; the rotated one is live.
    assert.equal(await devices.verifyCookie(deviceSecret, AppClient.creator), null);
    assert.ok(await devices.verifyCookie(stepped.deviceSecret, AppClient.creator));

    // The fresh access token is valid and app-scoped to the device's app.
    const p = tokens.verifyAccessToken(stepped.accessToken);
    assert.equal(p.app, AppClient.creator);
    assert.equal(p.accountId, principal.accountId);
  });

  it('a bad/missing device cookie is a UNIFORM 401 pin_rejected (no oracle)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    await assert.rejects(
      () => auth.stepUpWithPin('not-a-real-secret', AppClient.creator, '835274'),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 401 &&
        (e.getResponse() as { code?: string }).code === 'pin_rejected',
    );
    await assert.rejects(
      () => auth.stepUpWithPin('', AppClient.creator, '835274'),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'pin_rejected',
    );
  });

  it('a wrong PIN on a good device is the SAME uniform 401 pin_rejected', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0007`, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, '835274');
    await assert.rejects(
      () => auth.stepUpWithPin(result.deviceSecret!, AppClient.creator, '000000'),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 401 &&
        (e.getResponse() as { code?: string }).code === 'pin_rejected',
    );
  });

  it('retires the lapsed refresh family it was handed', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0008`, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, '835274');
    const lapsed = await tokens.createRefreshToken({
      accountId: principal.accountId,
      app: AppClient.creator,
    });
    await auth.stepUpWithPin(result.deviceSecret!, AppClient.creator, '835274', lapsed.token);
    const lapsedRow = await raw.refreshToken.findFirst({ where: { familyId: lapsed.familyId } });
    assert.ok(lapsedRow?.revokedAt, 'the presented lapsed family must be revoked');
  });
});

describe('pin/forgot — server-driven reset send (0010 §4.6/§7.7)', () => {
  it('sends via the OTP path resolved from the device cookie (no phone in the call)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}0009`;
    const normalized = phoneSvc.normalize(phone);
    const result = await enroll(phone, AppClient.creator);

    // Age the enrollment challenge so the reset send is not cooldown-blocked.
    await raw.otpChallenge.updateMany({
      where: { phone: normalized },
      data: { createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000) },
    });
    const before = await raw.otpChallenge.count({ where: { phone: normalized } });

    await auth.forgotPin(result.deviceSecret!, AppClient.creator);

    const afterCount = await raw.otpChallenge.count({ where: { phone: normalized } });
    assert.equal(afterCount, before + 1, 'forgot-PIN must issue a fresh challenge for the phone');
    assert.ok(
      delivery.sent.some((s) => s.phone === normalized),
      'a code was dispatched to the account phone the server resolved',
    );
  });

  it('an unresolvable device cookie is a silent no-op (enumeration-safe)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const before = delivery.sent.length;
    await auth.forgotPin('not-a-real-secret', AppClient.creator);
    assert.equal(delivery.sent.length, before, 'no send for an unknown device');
  });
});

describe('device/forget fully un-trusts; logout keeps device trust (0010 §13.3)', () => {
  it('device/forget revokes the resolved device row', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0010`, AppClient.creator);
    await auth.forgetDevice(result.deviceSecret!, AppClient.creator);
    assert.equal(await devices.verifyCookie(result.deviceSecret!, AppClient.creator), null);
  });

  it('logout revokes the refresh family but LEAVES device trust intact (→ PIN next, not OTP)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0011`, AppClient.creator);
    assert.ok(await devices.verifyCookie(result.deviceSecret!, AppClient.creator));

    // Resolve the family the presented refresh token belongs to, up front.
    const tokenHash = createHash('sha256')
      .update(result.tokens!.refreshToken)
      .digest('hex');
    const beforeRow = await raw.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });
    assert.ok(beforeRow, 'the enrollment refresh row must exist before logout');

    await auth.logout(result.tokens!.refreshToken);

    // (a) the whole refresh family is revoked (session ended).
    const liveInFamily = await raw.refreshToken.count({
      where: { familyId: beforeRow!.familyId, revokedAt: null },
    });
    assert.equal(liveInFamily, 0, 'logout must revoke the whole refresh family');

    // (b) the TrustedDevice row is untouched — the secret still resolves, so the
    // next entry is a free PIN step-up rather than a paid SMS-OTP.
    assert.ok(
      await devices.verifyCookie(result.deviceSecret!, AppClient.creator),
      'logout must NOT revoke device trust (0010 §13.3 accepted tradeoff)',
    );
  });
});

describe('me() surfaces live needsPinSetup (0010 CHANGE 1)', () => {
  it('needsPinSetup is true for a null pinHash and false once a PIN is set', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await enroll(`${PHONE_PREFIX}0015`, AppClient.creator);
    const principal = principalOf(result);

    const before = await auth.me(principal);
    assert.equal(before.needsPinSetup, true, 'a brand-new account has no PIN → gate fires');

    await auth.setPin(principal, '835274');

    const after = await auth.me(principal);
    assert.equal(
      after.needsPinSetup,
      false,
      'me() reads live DB state, so it self-clears the instant a PIN is set (no stale-token loop)',
    );
  });
});

describe('refresh clocks surface end-to-end (0010 §3/§6)', () => {
  it('idle-lapsed refresh → reauth_required (PIN), not invalid_grant', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const account = await raw.account.create({ data: { phone: `${PHONE_PREFIX}0012` } });
    const issued = await tokens.createRefreshToken({
      accountId: account.id,
      app: AppClient.creator,
    });
    await raw.refreshToken.updateMany({
      where: { accountId: account.id },
      data: {
        createdAt: new Date(Date.now() - (REFRESH_IDLE_TIMEOUT_SECONDS + 60) * 1000),
        familyExpiresAt: new Date(Date.now() + REFRESH_ABSOLUTE_TTL_SECONDS * 1000),
      },
    });
    await assert.rejects(
      () => auth.refresh(issued.token),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 401 &&
        (e.getResponse() as { code?: string }).code === 'reauth_required',
    );
  });

  it('cap-expired refresh → session_expired even when recently active', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const account = await raw.account.create({ data: { phone: `${PHONE_PREFIX}0013` } });
    const issued = await tokens.createRefreshToken({
      accountId: account.id,
      app: AppClient.creator,
    });
    await raw.refreshToken.updateMany({
      where: { accountId: account.id },
      data: { createdAt: new Date(), familyExpiresAt: new Date(Date.now() - 1000) },
    });
    await assert.rejects(
      () => auth.refresh(issued.token),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 401 &&
        (e.getResponse() as { code?: string }).code === 'session_expired',
    );
  });
});

describe('SMS budget circuit-breaker (0010 §7.7)', () => {
  it('fails closed at the ceiling with 503 sms_budget_exceeded', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    // Guarantee at least one challenge exists today, then set the ceiling to 1 so
    // the breaker is at/over budget. Concurrent inserts only raise the count, so
    // the assertion stays robust in a shared test DB.
    const total = await raw.otpChallenge.count({ where: { createdAt: { gte: startOfDay } } });
    if (total === 0) {
      await raw.otpChallenge.create({
        data: {
          phone: `${PHONE_PREFIX}9999`,
          codeHash: 'x',
          salt: 'x',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    }
    process.env.SMS_DAILY_BUDGET = '1';
    try {
      await assert.rejects(
        () => auth.requestOtp(`${PHONE_PREFIX}0014`),
        (e: unknown) =>
          e instanceof HttpException &&
          e.getStatus() === 503 &&
          (e.getResponse() as { code?: string }).code === 'sms_budget_exceeded',
      );
    } finally {
      delete process.env.SMS_DAILY_BUDGET;
    }
  });
});
