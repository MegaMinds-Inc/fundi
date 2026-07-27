import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaModule, runWithOrgContext } from '../../prisma';
import { AuthModule } from '../auth';
import { ProgramsModule } from '../programs';
import { EnrollmentModule } from './enrollment.module';
import { EnrollmentService } from './enrollment.service';

/**
 * DB-backed enrollment suite (Sprint 2). Follows the repo skip idiom
 * (org-isolation.integration.test.ts / auth.integration.test.ts): probe the
 * DB in before(), skip at runtime via t.skip() if unreachable — so `pnpm
 * test` stays green locally without Docker while running for real in CI.
 *
 * Service methods are called directly (not over HTTP), so each call that
 * touches a tenant-scoped model must be wrapped in `runWithOrgContext` itself
 * — in a real request this binding is done by OrgContextInterceptor, which
 * isn't in play here.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret';

const PHONE_PREFIX = '+23324901';
const ORG_A = 'itest_enroll_org_a';
const ORG_B = 'itest_enroll_org_b';

const raw = new PrismaClient();
let app: INestApplication;
let enrollment: EnrollmentService;
let dbAvailable = false;

interface Fixture {
  mentorId: string;
  publicProgramId: string;
  privateProgramId: string;
  cohortId: string;
}

async function seedOrg(orgId: string): Promise<Fixture> {
  await raw.organisation.create({ data: { id: orgId, name: orgId } });
  const mentor = await raw.mentor.create({
    data: {
      organisationId: orgId,
      name: `Mentor ${orgId}`,
      phone: `${PHONE_PREFIX}${orgId.length}`,
    },
  });
  // Both seed programs are `published`: invite() now gates on publish state
  // (ADR-014), so a draft seed would make every existing invite test fail.
  const publicProgram = await raw.program.create({
    data: {
      organisationId: orgId,
      ownerMentorId: mentor.id,
      title: `Public program (${orgId})`,
      shape: 'self_paced',
      visibility: 'public',
      status: 'published',
      publishedAt: new Date(),
    },
  });
  const privateProgram = await raw.program.create({
    data: {
      organisationId: orgId,
      ownerMentorId: mentor.id,
      title: `Private program (${orgId})`,
      shape: 'cohort',
      visibility: 'private',
      status: 'published',
      publishedAt: new Date(),
    },
  });
  const cohort = await raw.cohort.create({
    data: { organisationId: orgId, programId: privateProgram.id, name: 'Cohort 1' },
  });
  return {
    mentorId: mentor.id,
    publicProgramId: publicProgram.id,
    privateProgramId: privateProgram.id,
    cohortId: cohort.id,
  };
}

async function cleanup(): Promise<void> {
  // FK order: Enrollment -> Learner/Cohort/Program -> Mentor -> Organisation.
  await raw.enrollment.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.learner.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.cohort.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.program.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.mentor.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.organisation.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
}

let orgA: Fixture;
let orgB: Fixture;

before(async () => {
  try {
    await raw.$connect();
    await raw.$queryRaw`SELECT 1`;
    await raw.program.count();
    dbAvailable = true;
  } catch {
    console.warn(
      '⚠ Skipping enrollment integration test: no reachable Postgres at DATABASE_URL. ' +
        'Run `docker compose up -d && pnpm --filter api prisma:migrate` to enable it.',
    );
    return;
  }
  await cleanup();
  orgA = await seedOrg(ORG_A);
  orgB = await seedOrg(ORG_B);

  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule, ProgramsModule, EnrollmentModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  enrollment = app.get(EnrollmentService);
});

after(async () => {
  if (dbAvailable) {
    await cleanup();
    await app.close();
  }
  await raw.$disconnect();
});

describe('EnrollmentService (integration — needs Postgres)', () => {
  it('invite() into a public program lands active immediately', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const result = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.publicProgramId, null, '024 900 1101', 'Kofi'),
    );
    assert.equal(result.state, 'active');
    assert.ok(result.approvedAt, 'a public-program invite should be approved immediately');
  });

  it('invite() into a private program lands pending_approval', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const result = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.privateProgramId, orgA.cohortId, '024 900 1102', 'Abena'),
    );
    assert.equal(result.state, 'pending_approval');
    assert.equal(result.approvedAt, null);
  });

  it('invite() rejects a cohortId that does not belong to the program', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          enrollment.invite(orgA.publicProgramId, 'not-a-real-cohort-id', '024 900 1103'),
        ),
      BadRequestException,
    );
  });

  it('invite() rejects a null cohortId when the program has real cohorts', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    // Regression: a cohortId:null enrollment on a cohort-shaped program used
    // to succeed silently and then vanish from every getRoster() bucket
    // (found via a live end-to-end HTTP smoke test, not by unit reasoning).
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          enrollment.invite(orgA.privateProgramId, null, '024 900 1199'),
        ),
      BadRequestException,
    );
  });

  it('approve() moves a pending enrollment to active and sets approvedAt', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const invited = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.privateProgramId, orgA.cohortId, '024 900 1104', 'Yaw'),
    );
    assert.equal(invited.state, 'pending_approval');

    const approved = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.approve(invited.id),
    );
    assert.equal(approved.state, 'active');
    assert.ok(approved.approvedAt);
  });

  it('decline() hard-deletes the pending row', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const invited = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.privateProgramId, orgA.cohortId, '024 900 1105', 'Efua'),
    );

    await runWithOrgContext({ organisationId: ORG_A }, () => enrollment.decline(invited.id));

    const row = await raw.enrollment.findUnique({ where: { id: invited.id } });
    assert.equal(row, null, 'decline must hard-delete the row, not just change its state');
  });

  it('re-inviting an already-active enrollment throws a conflict', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.publicProgramId, null, '024 900 1106', 'Kwame'),
    );
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          enrollment.invite(orgA.publicProgramId, null, '024 900 1106'),
        ),
      ConflictException,
    );
  });

  it('re-inviting a dropped enrollment reactivates it instead of erroring', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const invited = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.privateProgramId, orgA.cohortId, '024 900 1107', 'Adjoa'),
    );
    await raw.enrollment.update({ where: { id: invited.id }, data: { state: 'dropped' } });

    const reactivated = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.privateProgramId, orgA.cohortId, '024 900 1107'),
    );
    assert.equal(reactivated.id, invited.id, 'reactivation should reuse the same enrollment row');
    assert.equal(reactivated.state, 'pending_approval');
  });

  it('getRoster() buckets a self-paced program into a single synthetic cohort', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.publicProgramId, null, '024 900 1108', 'Nana'),
    );
    const roster = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.getRoster(orgA.publicProgramId),
    );
    assert.equal(roster.cohorts.length, 1);
    assert.equal(roster.cohorts[0]?.id, '_all');
    assert.ok(roster.cohorts[0]?.roster.some((r) => r.name === 'Nana'));
  });

  it("getRoster() buckets a cohort program's roster per real Cohort row", async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const invited = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(orgA.privateProgramId, orgA.cohortId, '024 900 1109', 'Esi'),
    );
    await runWithOrgContext({ organisationId: ORG_A }, () => enrollment.approve(invited.id));

    const roster = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.getRoster(orgA.privateProgramId),
    );
    const cohort = roster.cohorts.find((c) => c.id === orgA.cohortId);
    assert.ok(cohort, 'expected the real cohort to appear');
    assert.ok(cohort?.roster.some((r) => r.name === 'Esi' && r.state === 'active'));
  });

  it('invite() into a DRAFT program is rejected (program_not_published)', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    // A brand-new draft program (status defaults to `draft`).
    const draft = await raw.program.create({
      data: {
        organisationId: ORG_A,
        ownerMentorId: orgA.mentorId,
        title: 'Draft program',
        shape: 'self_paced',
        visibility: 'public',
      },
    });
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          enrollment.invite(draft.id, null, '024 900 1120', 'TooEarly'),
        ),
      (err: unknown) => {
        assert.ok(err instanceof ConflictException, 'a draft invite must be a 409 conflict');
        assert.equal((err.getResponse() as { code: string }).code, 'program_not_published');
        return true;
      },
    );
    // Nothing should have been written for the rejected invite.
    const count = await raw.enrollment.count({ where: { programId: draft.id } });
    assert.equal(count, 0, 'a rejected invite must not create an enrollment');
  });

  it('invite() is allowed once the same program is published', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await raw.program.create({
      data: {
        organisationId: ORG_A,
        ownerMentorId: orgA.mentorId,
        title: 'Publish-then-invite program',
        shape: 'self_paced',
        visibility: 'public',
      },
    });
    // Draft first → rejected.
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          enrollment.invite(program.id, null, '024 900 1121', 'Later'),
        ),
      ConflictException,
    );
    // Publish it, then the very same invite succeeds.
    await raw.program.update({
      where: { id: program.id },
      data: { status: 'published', publishedAt: new Date() },
    });
    const result = await runWithOrgContext({ organisationId: ORG_A }, () =>
      enrollment.invite(program.id, null, '024 900 1121', 'Later'),
    );
    assert.equal(result.state, 'active', 'invite into a published public program lands active');
  });

  it("org isolation: org A cannot approve or see org B's enrollment", async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const bInvite = await runWithOrgContext({ organisationId: ORG_B }, () =>
      enrollment.invite(orgB.privateProgramId, orgB.cohortId, '024 900 1110', 'Org B learner'),
    );

    await assert.rejects(
      () => runWithOrgContext({ organisationId: ORG_A }, () => enrollment.approve(bInvite.id)),
      NotFoundException,
      "approving another org's enrollment id must 404, never silently succeed",
    );

    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          enrollment.getRoster(orgB.privateProgramId),
        ),
      NotFoundException,
      "reading another org's program roster must 404, never leak data",
    );
  });
});
