import assert from 'node:assert/strict';
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
import { PinService } from './pin.service';
import { TrustedDeviceService } from './trusted-device.service';
import { OtpDeliveryService, StubOtpDeliveryService } from './otp-delivery.service';
import type { VerifyOtpApiResult } from './auth.responses';
import { OTP_RESEND_COOLDOWN_MS } from './auth.constants';

/**
 * Integration suite for the H2 remediation — `POST /auth/pin/reset` (feature
 * 0010 §4.6/§12.6): the phone-less end of the forgot-PIN flow that consumes the
 * reset OTP AND sets the new PIN in ONE call, landing the user signed in.
 * Follows the repo skip idiom (probe the DB in before(), skip at runtime if it
 * is unreachable/unmigrated) and forces the STUB OTP driver two ways (env +
 * provider override) so the delivered code is deterministic regardless of the
 * ambient OTP_DELIVERY_DRIVER.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret';
process.env.PIN_PEPPER = process.env.PIN_PEPPER ?? 'integration-test-pin-pepper';
process.env.OTP_DELIVERY_DRIVER = 'stub';

const PHONE_PREFIX = '+23324903';
const OLD_PIN = '835274';
const NEW_PIN = '624839';
const WEAK_PIN = '000000';

const raw = new PrismaClient();
let app: INestApplication;
let dbAvailable = false;

let auth: AuthService;
let tokens: TokenService;
let phoneSvc: PhoneService;
let pins: PinService;
let devices: TrustedDeviceService;
let delivery: StubOtpDeliveryService;

/** Enroll a fresh session for `phone`/`app`, aging any prior challenge past the
 * resend cooldown first so the same identity can request another code. */
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

/** Issue a fresh reset OTP for `phoneInput` (aging the prior challenge so the
 * resend cooldown doesn't block it) and return the delivered code. */
async function freshResetCode(phoneInput: string): Promise<string> {
  const normalized = phoneSvc.normalize(phoneInput);
  await raw.otpChallenge.updateMany({
    where: { phone: normalized },
    data: { createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000) },
  });
  await auth.requestOtp(phoneInput);
  const code = delivery.lastCodeFor(normalized);
  assert.ok(code, `expected a reset code for ${normalized}`);
  return code;
}

function principalOf(result: VerifyOtpApiResult): Principal {
  assert.ok(result.tokens);
  return tokens.verifyAccessToken(result.tokens.accessToken);
}

function pinRejected(status: number, code?: string): boolean {
  return status === 401 && code === 'pin_rejected';
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
    console.warn('⚠ Skipping pin-reset integration test: no reachable/migrated Postgres.');
    return;
  }
  await cleanup();
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule],
  })
    .overrideProvider(OtpDeliveryService)
    .useClass(StubOtpDeliveryService)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  auth = app.get(AuthService);
  tokens = app.get(TokenService);
  phoneSvc = app.get(PhoneService);
  pins = app.get(PinService);
  devices = app.get(TrustedDeviceService);
  delivery = app.get(OtpDeliveryService) as StubOtpDeliveryService;
});

after(async () => {
  if (dbAvailable) {
    await cleanup();
    await app.close();
  }
  await raw.$disconnect();
});

describe('pin/reset — phone-based forgot-PIN reset (0010 §4.6/§12.6, Fix 3)', () => {
  it('phone + valid OTP + strong PIN → fresh session, NEW device enrolled, old families revoked, new PIN set', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}0101`;
    const result = await enroll(phone, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, OLD_PIN); // the PIN the user "forgot"
    const oldHash = (await raw.account.findUnique({ where: { id: principal.accountId } }))?.pinHash;

    // A second live family that MUST be revoked (no session survives a reset).
    const other = await tokens.createRefreshToken({
      accountId: principal.accountId,
      app: AppClient.creator,
    });

    const otpCode = await freshResetCode(phone);
    const sentBefore = delivery.sent.length;

    // Reset is PHONE-based now — the device cookie plays no part.
    const out = await auth.resetPin(phone, otpCode, NEW_PIN, AppClient.creator);

    // Fresh signed-in session with NO further SMS from the reset itself.
    assert.ok(out.accessToken, 'reset mints a fresh access token');
    assert.ok(out.refreshToken, 'reset mints a fresh refresh token');
    assert.equal(delivery.sent.length, sentBefore, 'the reset call itself sends no SMS');

    // A freshly enrolled device secret resolves to a live row; access token
    // app-scoped to the account. (The reset is device-independent — it enrolls a
    // new device rather than depending on / rotating an old, possibly-revoked one.)
    assert.ok(out.deviceSecret, 'reset enrolls and returns a device secret');
    const newDeviceRow = await devices.verifyCookie(out.deviceSecret, AppClient.creator);
    assert.ok(newDeviceRow, 'the returned secret resolves to a live device row');
    const p = tokens.verifyAccessToken(out.accessToken);
    assert.equal(p.app, AppClient.creator);
    assert.equal(p.accountId, principal.accountId);

    // Old families revoked, exactly the freshly minted one stays live.
    const otherRow = await raw.refreshToken.findFirst({ where: { familyId: other.familyId } });
    assert.ok(otherRow?.revokedAt, 'every pre-existing family is revoked (compromise hygiene)');
    const live = await raw.refreshToken.count({
      where: { accountId: principal.accountId, app: AppClient.creator, revokedAt: null },
    });
    assert.equal(live, 1, 'only the freshly minted family stays live');

    // The stored PIN actually CHANGED: old no longer verifies, new does.
    const newHash = (await raw.account.findUnique({ where: { id: principal.accountId } }))?.pinHash;
    assert.notEqual(newHash, oldHash, 'the stored pinHash must change on reset');
    assert.equal(
      (await pins.verifyPin(newDeviceRow!, OLD_PIN)).ok,
      false,
      'old PIN no longer works',
    );
    assert.equal((await pins.verifyPin(newDeviceRow!, NEW_PIN)).ok, true, 'the new PIN works');
  });

  it('resets even when the device is fully revoked (device-independent — the whole point)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}0105`;
    const result = await enroll(phone, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, OLD_PIN);
    // Revoke the enrolled device — mirrors the stuck-account repro.
    await devices.revoke(principal.accountId, AppClient.creator);
    assert.equal(await devices.verifyCookie(result.deviceSecret!, AppClient.creator), null);

    const otpCode = await freshResetCode(phone);
    const out = await auth.resetPin(phone, otpCode, NEW_PIN, AppClient.creator);

    assert.ok(out.accessToken, 'a revoked device does not block a phone-based reset');
    const newDeviceRow = await devices.verifyCookie(out.deviceSecret, AppClient.creator);
    assert.ok(newDeviceRow, 'a fresh device is enrolled and its secret resolves live');
    assert.equal((await pins.verifyPin(newDeviceRow!, NEW_PIN)).ok, true, 'the new PIN works');
  });

  it('a wrong/expired OTP is a UNIFORM 401 pin_rejected (no otp_invalid leak), PIN untouched', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}0102`;
    const result = await enroll(phone, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, OLD_PIN);
    const before = (await raw.account.findUnique({ where: { id: principal.accountId } }))?.pinHash;

    // The enrollment OTP was already consumed by verifyOtp; no unconsumed reset
    // challenge exists, so any code fails uniformly (not otp_invalid/otp_expired).
    await assert.rejects(
      () => auth.resetPin(phone, '000000', NEW_PIN, AppClient.creator),
      (e: unknown) =>
        e instanceof HttpException &&
        pinRejected(e.getStatus(), (e.getResponse() as { code?: string }).code),
    );
    const after = (await raw.account.findUnique({ where: { id: principal.accountId } }))?.pinHash;
    assert.equal(after, before, 'a failed OTP must not touch the stored PIN');
  });

  it('an unknown phone (valid OTP, no account) is the SAME uniform 401 pin_rejected (no enumeration)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    // A phone that has a live OTP challenge but NO account: requestOtp issues a
    // code without creating an account, so otp.verify passes but the account
    // lookup is null → the same uniform pin_rejected as a bad code (no oracle on
    // whether the phone maps to an account).
    const phone = `${PHONE_PREFIX}0106`;
    const otpCode = await freshResetCode(phone);
    const normalized = phoneSvc.normalize(phone);
    const accountBefore = await raw.account.findUnique({ where: { phone: normalized } });
    assert.equal(accountBefore, null, 'precondition: no account for this phone');

    await assert.rejects(
      () => auth.resetPin(phone, otpCode, NEW_PIN, AppClient.creator),
      (e: unknown) =>
        e instanceof HttpException &&
        pinRejected(e.getStatus(), (e.getResponse() as { code?: string }).code),
    );
    // The failed reset must not have created an account or set a PIN.
    const accountAfter = await raw.account.findUnique({ where: { phone: normalized } });
    assert.equal(accountAfter, null, 'a failed reset must not mint an account');
  });

  it('a weak PIN propagates 422 weak_pin (a form error, NOT collapsed to pin_rejected)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}0103`;
    const result = await enroll(phone, AppClient.creator);
    const principal = principalOf(result);
    await auth.setPin(principal, OLD_PIN);
    const otpCode = await freshResetCode(phone);

    await assert.rejects(
      () => auth.resetPin(phone, otpCode, WEAK_PIN, AppClient.creator),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 422 &&
        (e.getResponse() as { code?: string }).code === 'weak_pin',
    );
  });
});
