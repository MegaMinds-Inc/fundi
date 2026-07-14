import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppClient, MentorRole } from '@prisma/client';
import { TokenService } from './token.service';
import type { PrismaService } from '../../prisma';
import { ACCESS_TOKEN_TTL_SECONDS, JWT_CLOCK_TOLERANCE_SECONDS } from './auth.constants';

/**
 * Pure unit test (no DB) for the access-JWT half of TokenService: claim
 * shaping, the org claim being present/omitted, TTL, and the agreed clock
 * leeway (QA C.5 clock-skew / D.6). The refresh-token half is DB-backed and
 * lives in auth.integration.test.ts.
 */
describe('TokenService — access JWT', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  // Prisma is unused by sign/verify — a bare stub is enough for these cases.
  const prisma = {} as unknown as PrismaService;
  const svc = new TokenService(jwt, prisma);

  it('mints a token carrying sub/org/role/app and verifies back to a Principal', () => {
    const { accessToken, expiresIn } = svc.signAccessToken({
      accountId: 'acct_1',
      org: 'org_1',
      role: MentorRole.owner,
      app: AppClient.creator,
    });
    assert.equal(expiresIn, ACCESS_TOKEN_TTL_SECONDS);
    const principal = svc.verifyAccessToken(accessToken);
    assert.deepEqual(principal, {
      accountId: 'acct_1',
      org: 'org_1',
      role: MentorRole.owner,
      app: AppClient.creator,
    });
  });

  it('omits the org claim for an org-less onboarding token', () => {
    const { accessToken } = svc.signAccessToken({
      accountId: 'acct_2',
      role: MentorRole.owner,
      app: AppClient.creator,
    });
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;
    assert.equal('org' in decoded, false, 'org must be absent, not present-and-undefined');
    const principal = svc.verifyAccessToken(accessToken);
    assert.equal(principal.org, undefined);
  });

  it('rejects a garbage token', () => {
    assert.throws(
      () => svc.verifyAccessToken('not.a.jwt'),
      (e: unknown) => e instanceof UnauthorizedException,
    );
  });

  it('rejects a token signed with a different secret', () => {
    const other = new JwtService({ secret: 'a-different-secret' });
    const token = other.sign({ sub: 'x', role: MentorRole.mentor, app: AppClient.learner });
    assert.throws(
      () => svc.verifyAccessToken(token),
      (e: unknown) => e instanceof UnauthorizedException,
    );
  });

  it('tolerates a token expired within the clock-leeway window', () => {
    // Expired 10s ago; leeway is 30s, so verification must still succeed.
    const token = jwt.sign(
      { sub: 'acct_3', role: MentorRole.mentor, app: AppClient.learner },
      { expiresIn: -10 },
    );
    assert.ok(JWT_CLOCK_TOLERANCE_SECONDS > 10);
    const principal = svc.verifyAccessToken(token);
    assert.equal(principal.accountId, 'acct_3');
  });

  it('rejects a token expired well beyond the leeway window', () => {
    const token = jwt.sign(
      { sub: 'acct_4', role: MentorRole.mentor, app: AppClient.learner },
      { expiresIn: -(JWT_CLOCK_TOLERANCE_SECONDS + 60) },
    );
    assert.throws(
      () => svc.verifyAccessToken(token),
      (e: unknown) => e instanceof UnauthorizedException,
    );
  });
});
