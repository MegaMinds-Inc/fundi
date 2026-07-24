import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppClient, MentorRole, PrismaClient } from '@prisma/client';
import type { Principal } from '@fundi/types';
import { PrismaModule } from '../../prisma';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PhoneService } from './phone.service';
import { TokenService } from './token.service';
import type { VerifyOtpApiResult } from './auth.responses';
import { OtpDeliveryService, StubOtpDeliveryService } from './otp-delivery.service';
import {
  OTP_ISSUANCE_CAP,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  REFRESH_ABSOLUTE_TTL_SECONDS,
  REFRESH_IDLE_TIMEOUT_SECONDS,
  REFRESH_REUSE_GRACE_MS,
} from './auth.constants';

/**
 * DB-backed auth suite (QA C.2.2/C.2.3 + A.6). Follows the repo skip idiom
 * (org-isolation.integration.test.ts): probe the DB in before(), skip at
 * runtime via t.skip() if unreachable OR if the identity tables have not been
 * migrated yet — so `pnpm test` stays green locally without Docker/migration
 * while running for real in CI.
 */

// A fixed signing key for the whole suite (server-side only, honours the
// no-NEXT_PUBLIC_ env policy). Set before the module compiles.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret';

const PHONE_PREFIX = '+23324900';
const ORG_PREFIX = 'itest_auth_org';

const raw = new PrismaClient();
let app: INestApplication;
let dbAvailable = false;

let auth: AuthService;
let otp: OtpService;
let tokens: TokenService;
let phoneSvc: PhoneService;
let delivery: StubOtpDeliveryService;

/**
 * Log in through the real flow, aging any prior challenge for the phone past
 * the resend cooldown first so a test can log the same identity in twice.
 * Returns the verify result and the delivered code.
 */
async function freshLogin(phoneInput: string, appClient: AppClient): Promise<VerifyOtpApiResult> {
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

async function cleanup(): Promise<void> {
  const accounts = await raw.account.findMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  await raw.refreshToken.deleteMany({ where: { accountId: { in: ids } } });
  await raw.membership.deleteMany({ where: { accountId: { in: ids } } });
  await raw.otpChallenge.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await raw.mentor.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await raw.account.deleteMany({ where: { phone: { startsWith: PHONE_PREFIX } } });
  await raw.organisation.deleteMany({ where: { name: { startsWith: ORG_PREFIX } } });
}

before(async () => {
  try {
    await raw.$connect();
    await raw.$queryRaw`SELECT 1`;
    // The identity tables must be migrated; if not, skip rather than fail.
    await raw.account.count();
    dbAvailable = true;
  } catch {
    console.warn(
      '⚠ Skipping auth integration test: no reachable Postgres with the identity tables. ' +
        'Run the migration (or `prisma db push`) and set DATABASE_URL to enable it.',
    );
    return;
  }
  await cleanup();
  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  auth = app.get(AuthService);
  otp = app.get(OtpService);
  tokens = app.get(TokenService);
  phoneSvc = app.get(PhoneService);
  delivery = app.get(OtpDeliveryService) as StubOtpDeliveryService;
});

after(async () => {
  if (dbAvailable) {
    await cleanup();
    await app.close();
  }
  await raw.$disconnect();
});

describe('OTP lifecycle (C.2.3)', () => {
  it('issues a code that verifies, then consumes the challenge', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00001`;
    await otp.request(phone);
    const code = delivery.lastCodeFor(phone);
    assert.ok(code, 'stub must record the delivered code (non-production)');
    await otp.verify(phone, code);
    const row = await raw.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(row?.consumedAt, 'a verified challenge must be consumed');
  });

  it('locks the challenge after the attempt cap and rejects a late-correct code', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00002`;
    await otp.request(phone);
    const code = delivery.lastCodeFor(phone)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
      await assert.rejects(() => otp.verify(phone, wrong), HttpException);
    }
    // Even the correct code is now refused — the challenge is locked.
    await assert.rejects(
      () => otp.verify(phone, code),
      (e: unknown) =>
        e instanceof HttpException && (e.getResponse() as { code?: string }).code === 'otp_locked',
    );
    const row = await raw.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(row?.attempts, OTP_MAX_ATTEMPTS);
    assert.equal(row?.consumedAt, null, 'a locked challenge must never be consumed');
  });

  it('rejects an expired code with an expired-specific error', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00003`;
    await otp.request(phone);
    const code = delivery.lastCodeFor(phone)!;
    await raw.otpChallenge.updateMany({
      where: { phone },
      data: { expiresAt: new Date(Date.now() - OTP_TTL_MS) },
    });
    await assert.rejects(
      () => otp.verify(phone, code),
      (e: unknown) =>
        e instanceof HttpException && (e.getResponse() as { code?: string }).code === 'otp_expired',
    );
  });

  it('blocks replay of a consumed challenge', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00004`;
    await otp.request(phone);
    const code = delivery.lastCodeFor(phone)!;
    await otp.verify(phone, code);
    await assert.rejects(() => otp.verify(phone, code), HttpException);
  });

  it('enforces the resend cooldown (429)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00005`;
    await otp.request(phone);
    await assert.rejects(
      () => otp.request(phone),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 429 &&
        (e.getResponse() as { code?: string }).code === 'otp_cooldown',
    );
  });

  it('enforces the per-phone issuance cap (429)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00006`;
    // Seed the cap's worth of challenges spread across the window, all older
    // than the cooldown so only the issuance cap (not the cooldown) trips.
    const now = Date.now();
    for (let i = 0; i < OTP_ISSUANCE_CAP; i += 1) {
      await raw.otpChallenge.create({
        data: {
          phone,
          codeHash: 'x',
          salt: 'x',
          expiresAt: new Date(now + OTP_TTL_MS),
          createdAt: new Date(now - OTP_RESEND_COOLDOWN_MS - (i + 1) * 60_000),
        },
      });
    }
    await assert.rejects(
      () => otp.request(phone),
      (e: unknown) =>
        e instanceof HttpException &&
        e.getStatus() === 429 &&
        (e.getResponse() as { code?: string }).code === 'otp_rate_limited',
    );
  });

  it('does not enumerate: a request for an unknown phone succeeds like any other', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const phone = `${PHONE_PREFIX}00007`;
    const before = await raw.account.count({ where: { phone } });
    assert.equal(before, 0, 'precondition: no account for this phone');
    // Must not throw and must not reveal (or create) account existence.
    await otp.request(phone);
    const after = await raw.account.count({ where: { phone } });
    assert.equal(after, 0, 'requesting a code must never create/leak an account');
  });
});

describe('Refresh rotation + reuse detection (C.2.2)', () => {
  async function seedAccount(suffix: string): Promise<string> {
    const account = await raw.account.create({ data: { phone: `${PHONE_PREFIX}${suffix}` } });
    return account.id;
  }

  it('rotates: old row revoked + replacedById set, new row same family', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10001');
    const first = await tokens.createRefreshToken({ accountId, app: AppClient.creator });
    const rotated = await tokens.rotateRefreshToken(first.token);

    assert.equal(rotated.familyId, first.familyId, 'rotation keeps the family');
    assert.equal(rotated.accountId, accountId);
    assert.equal(rotated.app, AppClient.creator);

    const rows = await raw.refreshToken.findMany({ where: { familyId: first.familyId } });
    assert.equal(rows.length, 2);
    const old = rows.find((r) => r.replacedById != null)!;
    const fresh = rows.find((r) => r.replacedById == null)!;
    assert.ok(old.revokedAt, 'the rotated-away token must be revoked');
    assert.equal(old.replacedById, fresh.id);
    assert.equal(fresh.revokedAt, null, 'the fresh token must be usable');
  });

  it('detects reuse: replaying a revoked token revokes the whole family', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10002');
    const first = await tokens.createRefreshToken({ accountId, app: AppClient.creator });
    const rotated = await tokens.rotateRefreshToken(first.token); // first is now revoked

    // Age the revocation PAST the benign-race grace window so the replay is
    // treated as genuine reuse-after-detection (H1: a replay within the grace
    // window is tolerated as a concurrent-refresh race, not theft). The revoked
    // parent row is the one carrying a replacedById.
    await raw.refreshToken.updateMany({
      where: { familyId: first.familyId, replacedById: { not: null } },
      data: { revokedAt: new Date(Date.now() - (REFRESH_REUSE_GRACE_MS + 60_000)) },
    });

    // Replay the already-rotated token — this is theft.
    await assert.rejects(
      () => tokens.rotateRefreshToken(first.token),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'invalid_grant',
    );

    // The entire family is now revoked — even the once-valid child token.
    const rows = await raw.refreshToken.findMany({ where: { familyId: first.familyId } });
    assert.ok(
      rows.every((r) => r.revokedAt != null),
      'reuse must burn the whole family',
    );
    await assert.rejects(() => tokens.rotateRefreshToken(rotated.token), HttpException);
  });

  it('idle-lapsed token → reauth_required (PIN), not invalid_grant (0010 §3)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10003');
    const issued = await tokens.createRefreshToken({ accountId, app: AppClient.creator });
    // Age the presented token's createdAt past the idle window (createdAt IS the
    // last-activity stamp) while leaving the absolute cap well in the future.
    await raw.refreshToken.updateMany({
      where: { accountId },
      data: {
        createdAt: new Date(Date.now() - (REFRESH_IDLE_TIMEOUT_SECONDS + 60) * 1000),
        familyExpiresAt: new Date(Date.now() + REFRESH_ABSOLUTE_TTL_SECONDS * 1000),
      },
    });
    await assert.rejects(
      () => tokens.rotateRefreshToken(issued.token),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'reauth_required',
    );
    const count = await raw.refreshToken.count({ where: { accountId } });
    assert.equal(count, 1, 'an idle-lapsed token must not mint a replacement');
  });

  it('cap-expired token → session_expired even when recently active (0010 §3)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10006');
    const issued = await tokens.createRefreshToken({ accountId, app: AppClient.creator });
    // Fresh createdAt (idle NOT tripped), but the immutable family anchor is in
    // the past → the absolute cap fires regardless of activity.
    await raw.refreshToken.updateMany({
      where: { accountId },
      data: {
        createdAt: new Date(),
        familyExpiresAt: new Date(Date.now() - 1000),
      },
    });
    await assert.rejects(
      () => tokens.rotateRefreshToken(issued.token),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'session_expired',
    );
  });

  it('carries the family anchor forward UNCHANGED across rotations (no sliding)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10007');
    const first = await tokens.createRefreshToken({ accountId, app: AppClient.creator });
    const birthAnchor = (
      await raw.refreshToken.findFirst({ where: { familyId: first.familyId } })
    )?.familyExpiresAt;
    assert.ok(birthAnchor, 'a new family must anchor familyExpiresAt');

    // Rotate several times; each fresh row must keep the SAME anchor. If the
    // anchor were recomputed as now+TTL the cap would slide and never trip.
    let current = first.token;
    for (let i = 0; i < 3; i += 1) {
      const rotated = await tokens.rotateRefreshToken(current);
      current = rotated.token;
      const liveRow = await raw.refreshToken.findFirst({
        where: { familyId: first.familyId, revokedAt: null },
      });
      assert.equal(
        liveRow?.familyExpiresAt?.getTime(),
        birthAnchor.getTime(),
        'rotation must carry the birth anchor forward unchanged',
      );
    }

    // Push the (unchanged) anchor into the past → the cap now kills the family.
    await raw.refreshToken.updateMany({
      where: { familyId: first.familyId },
      data: { familyExpiresAt: new Date(Date.now() - 1000), createdAt: new Date() },
    });
    await assert.rejects(
      () => tokens.rotateRefreshToken(current),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'session_expired',
    );
  });

  it('theft (reuse) revokes the device row; a benign race does NOT (0010 §7.4)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    // --- theft path revokes device trust ---
    const theftAccount = await seedAccount('10008');
    const theftDevice = await raw.trustedDevice.create({
      data: { accountId: theftAccount, app: AppClient.creator, tokenHash: `td_${theftAccount}` },
    });
    const issued = await tokens.createRefreshToken({ accountId: theftAccount, app: AppClient.creator });
    await tokens.rotateRefreshToken(issued.token); // `issued` now revoked
    // Age past the benign-race grace window → genuine reuse-after-detection (F4).
    await raw.refreshToken.updateMany({
      where: { familyId: issued.familyId, replacedById: { not: null } },
      data: { revokedAt: new Date(Date.now() - (REFRESH_REUSE_GRACE_MS + 60_000)) },
    });
    await assert.rejects(
      () => tokens.rotateRefreshToken(issued.token), // replay = theft
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'invalid_grant',
    );
    const revokedDevice = await raw.trustedDevice.findUnique({ where: { id: theftDevice.id } });
    assert.ok(revokedDevice?.revokedAt, 'detected theft must revoke device trust');

    // --- benign concurrent race leaves device trust intact ---
    const raceAccount = await seedAccount('10009');
    const raceDevice = await raw.trustedDevice.create({
      data: { accountId: raceAccount, app: AppClient.creator, tokenHash: `td_${raceAccount}` },
    });
    const raceIssued = await tokens.createRefreshToken({
      accountId: raceAccount,
      app: AppClient.creator,
    });
    const results = await Promise.allSettled([
      tokens.rotateRefreshToken(raceIssued.token),
      tokens.rotateRefreshToken(raceIssued.token),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    const liveDevice = await raw.trustedDevice.findUnique({ where: { id: raceDevice.id } });
    assert.equal(liveDevice?.revokedAt, null, 'a benign race must NOT revoke device trust');
  });

  it('H1 grace: a just-rotated token replayed within the window is a benign race, not theft', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    // A device + a live session whose token was JUST rotated away (revoked
    // < REFRESH_REUSE_GRACE_MS ago) with a single legit replacement still live.
    const acct = await seedAccount('10010');
    const device = await raw.trustedDevice.create({
      data: { accountId: acct, app: AppClient.creator, tokenHash: `td_${acct}` },
    });
    const first = await tokens.createRefreshToken({ accountId: acct, app: AppClient.creator });
    await tokens.rotateRefreshToken(first.token); // `first` revoked ~now, replacement live

    // Replaying `first` immediately (cross-tab/prefetch race the Edge
    // single-flight cannot cover) must be tolerated: invalid_grant, but the
    // family stays alive and — critically — device trust is NOT revoked.
    await assert.rejects(
      () => tokens.rotateRefreshToken(first.token),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'invalid_grant',
    );
    const live = await raw.refreshToken.findFirst({
      where: { familyId: first.familyId, revokedAt: null },
    });
    assert.ok(live, 'the benign race must leave the replacement token usable');
    assert.equal(live?.replacedById, null, 'the replacement must remain un-rotated');
    const stillTrusted = await raw.trustedDevice.findUnique({ where: { id: device.id } });
    assert.equal(
      stillTrusted?.revokedAt,
      null,
      'a benign refresh race must NOT revoke device trust (H1)',
    );
  });

  it('H1 grace: replay OUTSIDE the window still burns the family + device trust (F4 intact)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const acct = await seedAccount('10011');
    const device = await raw.trustedDevice.create({
      data: { accountId: acct, app: AppClient.creator, tokenHash: `td_${acct}` },
    });
    const first = await tokens.createRefreshToken({ accountId: acct, app: AppClient.creator });
    await tokens.rotateRefreshToken(first.token);
    // Push the revocation stamp past the grace window → the replay is genuine
    // reuse-after-detection, not a race.
    await raw.refreshToken.updateMany({
      where: { familyId: first.familyId, replacedById: { not: null } },
      data: { revokedAt: new Date(Date.now() - (REFRESH_REUSE_GRACE_MS + 60_000)) },
    });
    await assert.rejects(
      () => tokens.rotateRefreshToken(first.token),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'invalid_grant',
    );
    const rows = await raw.refreshToken.findMany({ where: { familyId: first.familyId } });
    assert.ok(rows.every((r) => r.revokedAt != null), 'genuine reuse must burn the whole family');
    const revoked = await raw.trustedDevice.findUnique({ where: { id: device.id } });
    assert.ok(revoked?.revokedAt, 'genuine reuse must revoke device trust (F4)');
  });

  it('H1 grace: replay within the window but AFTER the replacement itself rotates → theft', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    // The replacement being itself revoked/rotated is the true
    // reuse-after-detection signature even inside the time window.
    const acct = await seedAccount('10012');
    const device = await raw.trustedDevice.create({
      data: { accountId: acct, app: AppClient.creator, tokenHash: `td_${acct}` },
    });
    const first = await tokens.createRefreshToken({ accountId: acct, app: AppClient.creator });
    const second = await tokens.rotateRefreshToken(first.token); // first → second
    await tokens.rotateRefreshToken(second.token); // second now rotated too (chain moved on)

    // `first` was revoked ~now (within the window), but its replacement `second`
    // is no longer live → not a single-rotation race → theft.
    await assert.rejects(
      () => tokens.rotateRefreshToken(first.token),
      (e: unknown) =>
        e instanceof HttpException &&
        (e.getResponse() as { code?: string }).code === 'invalid_grant',
    );
    const revoked = await raw.trustedDevice.findUnique({ where: { id: device.id } });
    assert.ok(revoked?.revokedAt, 'a moved-on chain replayed is theft → device trust revoked (F4)');
  });

  it('carries the app through rotation (a creator token stays a creator token)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10004');
    const learner = await tokens.createRefreshToken({ accountId, app: AppClient.learner });
    const rotated = await tokens.rotateRefreshToken(learner.token);
    assert.equal(rotated.app, AppClient.learner);
    const fresh = await raw.refreshToken.findFirst({
      where: { familyId: learner.familyId, revokedAt: null },
    });
    assert.equal(fresh?.app, AppClient.learner);
  });

  it('treats a concurrent double-rotation as a benign race, not theft', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const accountId = await seedAccount('10005');
    const issued = await tokens.createRefreshToken({ accountId, app: AppClient.creator });

    // Two tabs rotate the SAME still-valid token at once. Exactly one wins; the
    // loser is rejected WITHOUT tripping family revocation.
    const results = await Promise.allSettled([
      tokens.rotateRefreshToken(issued.token),
      tokens.rotateRefreshToken(issued.token),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'exactly one rotation must win');
    assert.equal(rejected.length, 1, 'the loser must be rejected');

    // The family is NOT fully revoked — the winner's new token still rotates.
    const winner = (
      fulfilled[0] as PromiseFulfilledResult<
        Awaited<ReturnType<TokenService['rotateRefreshToken']>>
      >
    ).value;
    const again = await tokens.rotateRefreshToken(winner.token);
    assert.equal(again.familyId, issued.familyId);
  });
});

describe('Org bootstrap on signup (A.6 / Multi-tenancy US-001)', () => {
  async function verifyAsCreator(phoneInput: string): Promise<{ accountId: string }> {
    const result = await freshLogin(phoneInput, AppClient.creator);
    assert.ok(result.tokens);
    const principal = tokens.verifyAccessToken(result.tokens.accessToken);
    return { accountId: principal.accountId };
  }

  it('first-time creator: org-less token + needsOnboarding, no membership yet', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const result = await freshLogin('024 900 2001', AppClient.creator);
    assert.equal(result.needsOnboarding, true);
    assert.deepEqual(result.memberships, []);
    const principal = tokens.verifyAccessToken(result.tokens!.accessToken);
    assert.equal(principal.org, undefined, 'the onboarding token must be org-less');
  });

  it('onboarding bootstraps Organisation + owner Mentor + Membership atomically', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const { accountId } = await verifyAsCreator('024 900 2002');
    const principal: Principal = {
      accountId,
      app: AppClient.creator,
      role: MentorRole.owner,
    };
    const orgName = `${ORG_PREFIX}_alpha`;
    const out = await auth.onboard(principal, orgName, 'Ama Owner');

    assert.equal(out.memberships.length, 1);
    const m = out.memberships[0];
    assert.equal(m.role, MentorRole.owner);
    assert.equal(m.organisationName, orgName);
    assert.ok(m.mentorId, 'membership must resolve to the owner Mentor row');

    // The re-issued token now carries the org claim.
    const principalAfter = tokens.verifyAccessToken(out.tokens.accessToken);
    assert.equal(principalAfter.org, m.organisationId);

    // No orphans: exactly one org, one owner mentor (stamped via context), one membership.
    const org = await raw.organisation.findUnique({ where: { id: m.organisationId } });
    assert.ok(org);
    const mentors = await raw.mentor.findMany({ where: { organisationId: m.organisationId } });
    assert.equal(mentors.length, 1);
    assert.equal(mentors[0].role, MentorRole.owner);
    assert.equal(
      mentors[0].organisationId,
      m.organisationId,
      'owner Mentor stamped with org context',
    );
    const memberships = await raw.membership.findMany({ where: { accountId } });
    assert.equal(memberships.length, 1);
  });

  it('onboarding is idempotent: re-running does not mint a second org', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const { accountId } = await verifyAsCreator('024 900 2003');
    const principal: Principal = { accountId, app: AppClient.creator, role: MentorRole.owner };
    const first = await auth.onboard(principal, `${ORG_PREFIX}_beta`, 'Kofi Owner');
    const second = await auth.onboard(principal, `${ORG_PREFIX}_beta_again`, 'Kofi Owner');

    assert.equal(
      second.memberships[0].organisationId,
      first.memberships[0].organisationId,
      'a re-run must recover the same org, not create a new one',
    );
    const orgs = await raw.membership.findMany({ where: { accountId } });
    assert.equal(orgs.length, 1, 'still exactly one membership after re-onboarding');
  });

  it('a returning creator with a membership logs in with the org claim, no onboarding', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const { accountId } = await verifyAsCreator('024 900 2004');
    const principal: Principal = { accountId, app: AppClient.creator, role: MentorRole.owner };
    await auth.onboard(principal, `${ORG_PREFIX}_gamma`, 'Yaa Owner');

    // Log in again from scratch (freshLogin ages the prior challenge past cooldown).
    const result = await freshLogin('024 900 2004', AppClient.creator);
    assert.equal(result.needsOnboarding, false);
    assert.equal(result.memberships.length, 1);
    const p = tokens.verifyAccessToken(result.tokens!.accessToken);
    assert.equal(p.org, result.memberships[0].organisationId);
  });
});
