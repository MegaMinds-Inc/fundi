import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppClient, MentorRole, PrismaClient } from '@prisma/client';
import { PrismaModule, PrismaService } from '../../prisma';
import { AuthModule } from './auth.module';
import { TokenService } from './token.service';

/**
 * HTTP-boundary proof (QA C.2.1) that the AuthGuard + global
 * OrgContextInterceptor actually bind org context on a REAL request — that the
 * AsyncLocalStorage zone survives the rxjs pipeline
 * (`from(runWithOrgContext(... lastValueFrom(next.handle())))`) across
 * interceptor → controller → service → lazy Prisma `await`. Unlike
 * org-scope.test.ts / org-isolation.integration.test.ts (which bind context by
 * hand), this drives it through the wired NestJS stack.
 *
 * A throwaway tenant controller stands in for a real domain route so this suite
 * owns its own surface (no dependency on modules other agents own).
 */

// A test-only tenant route: it touches a tenant-scoped model (Mentor), so it
// only returns rows if the interceptor bound an org context from the token.
@Controller('itest-tenant')
class ItestTenantController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mentors')
  async mentors(): Promise<{ id: string; organisationId: string }[]> {
    const rows = await this.prisma.client.mentor.findMany();
    return rows.map((m) => ({ id: m.id, organisationId: m.organisationId }));
  }
}

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret';

const raw = new PrismaClient();
const ORG_A = 'itest_bind_org_a';
const ORG_B = 'itest_bind_org_b';
const MENTOR_PHONE_PREFIX = '+23324901';
const PUBLIC_PHONE_PREFIX = '+23324902';

let app: INestApplication;
let baseUrl: string;
let tokens: TokenService;
let dbAvailable = false;

async function cleanup(): Promise<void> {
  await raw.mentor.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.organisation.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
  await raw.otpChallenge.deleteMany({ where: { phone: { startsWith: PUBLIC_PHONE_PREFIX } } });
}

async function seed(): Promise<void> {
  await raw.organisation.create({ data: { id: ORG_A, name: ORG_A } });
  await raw.organisation.create({ data: { id: ORG_B, name: ORG_B } });
  await raw.mentor.create({
    data: {
      organisationId: ORG_A,
      name: 'Owner A',
      phone: `${MENTOR_PHONE_PREFIX}0001`,
      role: MentorRole.owner,
    },
  });
  await raw.mentor.create({
    data: {
      organisationId: ORG_B,
      name: 'Owner B',
      phone: `${MENTOR_PHONE_PREFIX}0002`,
      role: MentorRole.owner,
    },
  });
}

before(async () => {
  try {
    await raw.$connect();
    await raw.$queryRaw`SELECT 1`;
    await raw.account.count();
    dbAvailable = true;
  } catch {
    console.warn(
      '⚠ Skipping org-binding HTTP test: no reachable Postgres with the identity tables.',
    );
    return;
  }
  await cleanup();
  await seed();

  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule],
    controllers: [ItestTenantController],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
  tokens = app.get(TokenService);

  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (dbAvailable) {
    await cleanup();
    await app.close();
  }
  await raw.$disconnect();
});

function tokenFor(org: string | undefined): string {
  return tokens.signAccessToken({
    accountId: 'itest-bind-acct',
    org,
    role: MentorRole.owner,
    app: AppClient.creator,
  }).accessToken;
}

describe('org context binding over HTTP (C.2.1 — the wired path)', () => {
  it('binds the org from the token: a request as Org A sees only Org A rows', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const res = await fetch(`${baseUrl}/itest-tenant/mentors`, {
      headers: { authorization: `Bearer ${tokenFor(ORG_A)}` },
    });
    assert.equal(res.status, 200);
    const rows = (await res.json()) as { organisationId: string }[];
    assert.equal(rows.length, 1, 'must see exactly Org A’s single mentor');
    assert.ok(
      rows.every((r) => r.organisationId === ORG_A),
      'the interceptor bound Org A from the token — no Org B row may appear',
    );
  });

  it('a token for Org B sees only Org B rows (proves it is token-driven, not hard-wired)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const res = await fetch(`${baseUrl}/itest-tenant/mentors`, {
      headers: { authorization: `Bearer ${tokenFor(ORG_B)}` },
    });
    assert.equal(res.status, 200);
    const rows = (await res.json()) as { organisationId: string }[];
    assert.equal(rows.length, 1);
    assert.ok(rows.every((r) => r.organisationId === ORG_B));
  });

  it('no token → 401 and no rows leak (loud fail, not an empty 200)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const res = await fetch(`${baseUrl}/itest-tenant/mentors`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { code?: string };
    assert.notEqual(res.status, 200);
    assert.equal(body.code, 'no_token');
  });

  it('org-less token on a tenant route fails loudly (403), never an unscoped 200', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    // A valid JWT with NO org claim (onboarding token) reaches a tenant route:
    // the interceptor binds nothing, the engine throws MissingOrgContextError,
    // and the filter maps it to 403 — the invariant is "never a 200 with rows".
    const res = await fetch(`${baseUrl}/itest-tenant/mentors`, {
      headers: { authorization: `Bearer ${tokenFor(undefined)}` },
    });
    assert.notEqual(res.status, 200, 'must never return a 200 with unscoped rows');
    assert.equal(res.status, 403);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, 'org_context_required');
  });

  it('a @Public() route is reachable with no token (else login deadlocks)', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const res = await fetch(`${baseUrl}/auth/otp/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '024 902 0001' }),
    });
    assert.equal(res.status, 204, 'otp/request is @Public and enumeration-safe (204)');
  });

  it('a guarded auth route (/auth/me) requires a token', async (t) => {
    if (!dbAvailable) return t.skip('no DB');
    const res = await fetch(`${baseUrl}/auth/me`);
    assert.equal(res.status, 401);
  });
});
