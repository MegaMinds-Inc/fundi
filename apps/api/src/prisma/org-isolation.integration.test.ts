import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { runWithOrgContext, MissingOrgContextError } from './org-context';
import { scopeOperation } from './scope-operation';

/**
 * End-to-end tenant-isolation test (Sprint 0, Task 5 acceptance criteria 3 & 4).
 *
 * Requires a live Postgres with the migration applied:
 *   docker compose up -d
 *   pnpm --filter api prisma migrate dev
 *   pnpm --filter api test
 *
 * If DATABASE_URL isn't set/reachable (e.g. Docker not up), the suite SKIPS
 * rather than failing — so `pnpm test` stays green on a machine without the
 * local DB, while still running for real in CI / on a configured dev machine.
 * The pure scoping logic is always covered offline by org-scope.test.ts.
 */

// Raw (unextended) client — used to seed BOTH orgs' data, deliberately crossing
// org boundaries the way only trusted setup code may.
const raw = new PrismaClient();
// The org-scoped client — the exact extension the app uses (prisma.service.ts).
const scoped = raw.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const s = scopeOperation(model, operation, args as Record<string, unknown>);
        return query(s as typeof args);
      },
    },
  },
});

let dbAvailable = false;
const ORG_A = 'itest_org_a';
const ORG_B = 'itest_org_b';

async function seedOrg(orgId: string, programTitle: string): Promise<void> {
  await raw.organisation.create({ data: { id: orgId, name: orgId } });
  const mentor = await raw.mentor.create({
    data: { organisationId: orgId, name: `Mentor ${orgId}`, phone: `+2330000${orgId.length}` },
  });
  await raw.program.create({
    data: {
      organisationId: orgId,
      ownerMentorId: mentor.id,
      title: programTitle,
      shape: 'self_paced',
    },
  });
}

describe('org isolation (integration — needs Postgres)', () => {
  before(async () => {
    try {
      await raw.$connect();
      await raw.$queryRaw`SELECT 1`;
      dbAvailable = true;
    } catch {
      console.warn(
        '⚠ Skipping org-isolation integration test: no reachable Postgres at DATABASE_URL. ' +
          'Run `docker compose up -d && pnpm --filter api prisma migrate dev` to enable it.',
      );
      return;
    }
    await raw.mentor.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
    await raw.organisation.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    await seedOrg(ORG_A, 'A program');
    await seedOrg(ORG_B, 'B program');
  });

  after(async () => {
    if (dbAvailable) {
      await raw.mentor.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
      await raw.organisation.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    }
    await raw.$disconnect();
  });

  it("returns zero of Org B's rows when querying as Org A", { skip: !dbAvailable }, async () => {
    const asA = await runWithOrgContext({ organisationId: ORG_A }, () => scoped.program.findMany());
    assert.equal(asA.length, 1, 'Org A should see exactly its own one program');
    assert.equal(asA[0].title, 'A program');
    assert.ok(
      asA.every((p) => p.organisationId === ORG_A),
      'a query as Org A must never return an Org B row',
    );
  });

  it('throws instead of running unscoped with no org context', { skip: !dbAvailable }, async () => {
    await assert.rejects(() => scoped.program.findMany(), MissingOrgContextError);
  });
});
