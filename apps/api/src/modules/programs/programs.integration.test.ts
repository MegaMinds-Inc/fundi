import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Principal } from '@fundi/types';
import { PrismaClient } from '@prisma/client';
import { PrismaModule, runWithOrgContext } from '../../prisma';
import { AuthModule } from '../auth';
import { ProgramsModule } from './programs.module';
import { ProgramsController } from './programs.controller';
import { ModulesController } from './modules.controller';
import { LessonsController } from './lessons.controller';
import { ProgramsService } from './programs.service';

/**
 * DB-backed programs suite (feature 0012). Same skip idiom as the enrollment
 * suite: probe Postgres in before(), skip at runtime if unreachable. Service
 * methods are called directly, so every call touching a tenant-scoped model is
 * wrapped in `runWithOrgContext` (OrgContextInterceptor isn't in play here).
 *
 * OTP_DELIVERY_DRIVER is forced to `stub` so importing AuthModule never reaches
 * for a real SMS provider at boot.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-jwt-secret';
process.env.OTP_DELIVERY_DRIVER = 'stub';

const ORG_A = 'itest_programs_org_a';
const ORG_B = 'itest_programs_org_b';
const ACCOUNT_CREATOR = 'itest_programs_acct_creator';
const ACCOUNT_NON_CREATOR = 'itest_programs_acct_noncreator';

const raw = new PrismaClient();
let app: INestApplication;
let programs: ProgramsService;
let controller: ProgramsController;
let modulesController: ModulesController;
let lessonsController: LessonsController;
let dbAvailable = false;

/** Run a service call inside ORG_A's tenant context (the common case here). */
const inOrgA = <T>(fn: () => Promise<T>): Promise<T> =>
  runWithOrgContext({ organisationId: ORG_A }, fn);
const readProgram = (id: string) => raw.program.findUniqueOrThrow({ where: { id } });

interface Fixture {
  mentorId: string;
  programId: string;
}

async function seedOrg(orgId: string): Promise<Fixture> {
  await raw.organisation.create({ data: { id: orgId, name: orgId } });
  const mentor = await raw.mentor.create({
    data: { organisationId: orgId, name: `Mentor ${orgId}`, phone: `+2332490${orgId.length}00` },
  });
  const program = await raw.program.create({
    data: {
      organisationId: orgId,
      ownerMentorId: mentor.id,
      title: `Seed program (${orgId})`,
      shape: 'self_paced',
      visibility: 'public',
    },
  });
  return { mentorId: mentor.id, programId: program.id };
}

async function cleanup(): Promise<void> {
  await raw.enrollment.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.learner.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.lesson.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.module.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.cohort.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.program.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.membership.deleteMany({
    where: { accountId: { in: [ACCOUNT_CREATOR, ACCOUNT_NON_CREATOR] } },
  });
  await raw.mentor.deleteMany({ where: { organisationId: { in: [ORG_A, ORG_B] } } });
  await raw.account.deleteMany({ where: { id: { in: [ACCOUNT_CREATOR, ACCOUNT_NON_CREATOR] } } });
  await raw.organisation.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
}

let orgA: Fixture;
let orgB: Fixture;

const creatorPrincipal: Principal = {
  accountId: ACCOUNT_CREATOR,
  org: ORG_A,
  role: 'owner',
  app: 'creator',
};

before(async () => {
  try {
    await raw.$connect();
    await raw.$queryRaw`SELECT 1`;
    await raw.program.count();
    dbAvailable = true;
  } catch {
    console.warn(
      '⚠ Skipping programs integration test: no reachable Postgres at DATABASE_URL. ' +
        'Run `docker compose up -d && pnpm --filter api prisma:migrate` to enable it.',
    );
    return;
  }
  await cleanup();
  orgA = await seedOrg(ORG_A);
  orgB = await seedOrg(ORG_B);

  // Creator account: a Membership in ORG_A that resolves to the org's Mentor.
  await raw.account.create({ data: { id: ACCOUNT_CREATOR, phone: '+233249000001' } });
  await raw.membership.create({
    data: {
      accountId: ACCOUNT_CREATOR,
      organisationId: ORG_A,
      role: 'owner',
      mentorId: orgA.mentorId,
    },
  });

  // Non-creator account: a Membership in ORG_A that carries NO mentorId.
  await raw.account.create({ data: { id: ACCOUNT_NON_CREATOR, phone: '+233249000002' } });
  await raw.membership.create({
    data: { accountId: ACCOUNT_NON_CREATOR, organisationId: ORG_A, role: 'mentor' },
  });

  const moduleRef = await Test.createTestingModule({
    imports: [PrismaModule, AuthModule, ProgramsModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  programs = app.get(ProgramsService);
  controller = app.get(ProgramsController);
  modulesController = app.get(ModulesController);
  lessonsController = app.get(LessonsController);
});

after(async () => {
  if (dbAvailable) {
    await cleanup();
    await app.close();
  }
  await raw.$disconnect();
});

describe('ProgramsService (integration — needs Postgres)', () => {
  it('createProgram() writes a draft with the resolved owner mentor + org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const created = await runWithOrgContext({ organisationId: ORG_A }, () =>
      programs.createProgram(creatorPrincipal, {
        title: 'My first program',
        shape: 'cohort',
        visibility: 'private',
        description: 'A description',
      }),
    );
    assert.equal(created.status, 'draft');
    assert.equal(created.coverStyle, 'gradient', 'coverStyle defaults to gradient');
    assert.equal(created.shape, 'cohort');
    assert.equal(created.visibility, 'private');

    const row = await raw.program.findUnique({ where: { id: created.id } });
    assert.ok(row);
    assert.equal(row?.status, 'draft');
    assert.equal(row?.ownerMentorId, orgA.mentorId, 'ownerMentorId resolved from membership');
    assert.equal(row?.organisationId, ORG_A, 'organisationId auto-stamped from bound context');
  });

  it('createProgram() rejects an account whose membership carries no mentorId', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const nonCreator: Principal = {
      accountId: ACCOUNT_NON_CREATOR,
      org: ORG_A,
      role: 'mentor',
      app: 'creator',
    };
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          programs.createProgram(nonCreator, {
            title: 'Should fail',
            shape: 'self_paced',
            visibility: 'public',
          }),
        ),
      ForbiddenException,
    );
  });

  it('listPrograms() returns the enriched fields with correct counts', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    // Two modules + one active and one dropped enrollment on the ORG_A seed.
    await raw.module.create({
      data: { organisationId: ORG_A, programId: orgA.programId, title: 'M1', order: 1 },
    });
    await raw.module.create({
      data: { organisationId: ORG_A, programId: orgA.programId, title: 'M2', order: 2 },
    });
    const learner = await raw.learner.create({
      data: { organisationId: ORG_A, phone: '+233249001111' },
    });
    const learner2 = await raw.learner.create({
      data: { organisationId: ORG_A, phone: '+233249002222' },
    });
    await raw.enrollment.create({
      data: {
        organisationId: ORG_A,
        programId: orgA.programId,
        learnerId: learner.id,
        state: 'active',
      },
    });
    await raw.enrollment.create({
      data: {
        organisationId: ORG_A,
        programId: orgA.programId,
        learnerId: learner2.id,
        state: 'dropped',
      },
    });

    const list = await runWithOrgContext({ organisationId: ORG_A }, () => programs.listPrograms());
    const seed = list.find((p) => p.id === orgA.programId);
    assert.ok(seed, 'seed program should be listed');
    assert.equal(seed?.moduleCount, 2, 'moduleCount counts modules');
    assert.equal(seed?.learnerCount, 1, 'learnerCount counts only active enrollments');
    assert.equal(seed?.status, 'draft');
    assert.equal(seed?.coverStyle, 'gradient');
  });

  it('getProgramDetail() returns modules + lessons ordered', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const created = await runWithOrgContext({ organisationId: ORG_A }, () =>
      programs.createProgram(creatorPrincipal, {
        title: 'Detail program',
        shape: 'self_paced',
        visibility: 'public',
      }),
    );
    const mod = await raw.module.create({
      data: { organisationId: ORG_A, programId: created.id, title: 'Module 1', order: 1 },
    });
    await raw.lesson.create({
      data: { organisationId: ORG_A, moduleId: mod.id, title: 'Lesson B', type: 'text', order: 2 },
    });
    await raw.lesson.create({
      data: { organisationId: ORG_A, moduleId: mod.id, title: 'Lesson A', type: 'text', order: 1 },
    });

    const detail = await runWithOrgContext({ organisationId: ORG_A }, () =>
      programs.getProgramDetail(created.id),
    );
    assert.equal(detail.modules.length, 1);
    assert.equal(detail.modules[0]?.lessons.length, 2);
    assert.equal(detail.modules[0]?.lessons[0]?.title, 'Lesson A', 'lessons ordered by order asc');
  });

  it('getProgramDetail() 404s for another org’s program', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          programs.getProgramDetail(orgB.programId),
        ),
      NotFoundException,
      "reading another org's program must 404, never leak it",
    );
  });

  it('updateProgram() updates fields and bumps updatedAt', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const created = await runWithOrgContext({ organisationId: ORG_A }, () =>
      programs.createProgram(creatorPrincipal, {
        title: 'Before',
        shape: 'self_paced',
        visibility: 'public',
      }),
    );
    const before = await raw.program.findUniqueOrThrow({ where: { id: created.id } });
    await sleep(10);

    const updated = await runWithOrgContext({ organisationId: ORG_A }, () =>
      programs.updateProgram(created.id, { title: 'After', visibility: 'private' }),
    );
    assert.equal(updated.title, 'After');
    assert.equal(updated.visibility, 'private');
    assert.ok(
      new Date(updated.updatedAt).getTime() > before.updatedAt.getTime(),
      'updatedAt must bump on patch',
    );
  });

  it('updateProgram() 404s for another org’s program', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await assert.rejects(
      () =>
        runWithOrgContext({ organisationId: ORG_A }, () =>
          programs.updateProgram(orgB.programId, { title: 'hijack' }),
        ),
      NotFoundException,
    );
  });

  it('controller rejects a bad shape / visibility / coverStyle enum', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    assert.throws(
      () =>
        controller.create(creatorPrincipal, {
          title: 'x',
          shape: 'not_a_shape' as never,
          visibility: 'public',
        }),
      BadRequestException,
      'bad shape rejected',
    );
    assert.throws(
      () =>
        controller.create(creatorPrincipal, {
          title: 'x',
          shape: 'self_paced',
          visibility: 'everyone' as never,
        }),
      BadRequestException,
      'bad visibility rejected',
    );
    assert.throws(
      () =>
        controller.create(creatorPrincipal, {
          title: 'x',
          shape: 'self_paced',
          visibility: 'public',
          coverStyle: 'sparkles' as never,
        }),
      BadRequestException,
      'bad coverStyle rejected',
    );
    assert.throws(
      () =>
        controller.create(creatorPrincipal, {
          title: '   ',
          shape: 'self_paced',
          visibility: 'public',
        }),
      BadRequestException,
      'empty title rejected',
    );
  });
});

describe('ProgramsService — Module/Lesson editing (slice 2, needs Postgres)', () => {
  // A fresh draft program owned by ORG_A, for a test to mutate in isolation.
  const freshProgram = () =>
    inOrgA(() =>
      programs.createProgram(creatorPrincipal, {
        title: 'Builder program',
        shape: 'self_paced',
        visibility: 'public',
      }),
    );

  it('createModule() appends order (0,1,2…), defaults unlockMode=immediate', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const m0 = await inOrgA(() => programs.createModule(program.id, { title: 'Intro' }));
    const m1 = await inOrgA(() => programs.createModule(program.id, { title: 'Deep dive' }));
    assert.equal(m0.order, 0, 'first module appends at 0');
    assert.equal(m1.order, 1, 'second module appends at max+1');
    assert.equal(m0.unlockMode, 'immediate', 'unlockMode defaults to immediate');
    assert.deepEqual(m0.lessons, [], 'a new module has no lessons');
    const row = await raw.module.findUnique({ where: { id: m0.id } });
    assert.equal(row?.organisationId, ORG_A, 'organisationId auto-stamped');
  });

  it('createModule() 404s for a program in another org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await assert.rejects(
      () => inOrgA(() => programs.createModule(orgB.programId, { title: 'hijack' })),
      NotFoundException,
    );
  });

  it('updateModule() patches a subset and 404s cross-org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    const updated = await inOrgA(() =>
      programs.updateModule(mod.id, {
        description: 'Now with detail',
        unlockMode: 'after_days',
        unlockDays: 3,
      }),
    );
    assert.equal(updated.description, 'Now with detail');
    assert.equal(updated.unlockMode, 'after_days');
    assert.equal(updated.unlockDays, 3);
    assert.equal(updated.title, 'M', 'untouched fields preserved');

    // Seed a module in ORG_B and confirm ORG_A cannot patch it.
    const bMod = await raw.module.create({
      data: { organisationId: ORG_B, programId: orgB.programId, title: 'B', order: 0 },
    });
    await assert.rejects(
      () => inOrgA(() => programs.updateModule(bMod.id, { title: 'hijack' })),
      NotFoundException,
    );
  });

  it('deleteModule() cascades to lessons and 404s cross-org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    const lesson = await inOrgA(() => programs.createLesson(mod.id, { title: 'L', type: 'text' }));
    await inOrgA(() => programs.deleteModule(mod.id));
    assert.equal(await raw.module.findUnique({ where: { id: mod.id } }), null);
    assert.equal(
      await raw.lesson.findUnique({ where: { id: lesson.id } }),
      null,
      'onDelete: Cascade removes the module’s lessons',
    );
    await assert.rejects(
      () => inOrgA(() => programs.deleteModule(mod.id)),
      NotFoundException,
      'deleting an already-gone module 404s',
    );
  });

  it('moveModule() swaps order with the adjacent sibling; boundary is a no-op', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const a = await inOrgA(() => programs.createModule(program.id, { title: 'A' })); // order 0
    const b = await inOrgA(() => programs.createModule(program.id, { title: 'B' })); // order 1

    await inOrgA(() => programs.moveModule(a.id, 'down')); // A<->B
    assert.equal((await raw.module.findUniqueOrThrow({ where: { id: a.id } })).order, 1);
    assert.equal((await raw.module.findUniqueOrThrow({ where: { id: b.id } })).order, 0);

    await inOrgA(() => programs.moveModule(a.id, 'up')); // back to A=0, B=1
    assert.equal((await raw.module.findUniqueOrThrow({ where: { id: a.id } })).order, 0);
    assert.equal((await raw.module.findUniqueOrThrow({ where: { id: b.id } })).order, 1);

    // Boundary: moving the first module up does nothing (no throw, no change).
    await inOrgA(() => programs.moveModule(a.id, 'up'));
    assert.equal((await raw.module.findUniqueOrThrow({ where: { id: a.id } })).order, 0);
    await assert.rejects(
      () => inOrgA(() => programs.moveModule(orgB.programId, 'up')),
      NotFoundException,
      'moving a non-existent/cross-org module 404s',
    );
  });

  it('createLesson() appends with content={}, validates via controller, 404s cross-org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    const l0 = await inOrgA(() => programs.createLesson(mod.id, { title: 'L0', type: 'text' }));
    const l1 = await inOrgA(() => programs.createLesson(mod.id, { title: 'L1', type: 'video' }));
    assert.equal(l0.order, 0);
    assert.equal(l1.order, 1);
    assert.deepEqual(l0.content, {}, 'content defaults to {}');
    assert.equal(l1.type, 'video');

    const bMod = await raw.module.create({
      data: { organisationId: ORG_B, programId: orgB.programId, title: 'B', order: 5 },
    });
    await assert.rejects(
      () => inOrgA(() => programs.createLesson(bMod.id, { title: 'x', type: 'text' })),
      NotFoundException,
    );
  });

  it('updateLesson() round-trips content, incl. a type switch; 404s cross-org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    const lesson = await inOrgA(() => programs.createLesson(mod.id, { title: 'L', type: 'text' }));

    // text content
    const textContent = { body: 'Hello **world**' };
    const afterText = await inOrgA(() =>
      programs.updateLesson(lesson.id, { content: textContent }),
    );
    assert.deepEqual(afterText.content, textContent, 'text content stored verbatim');

    // switch type video -> the client sends a different content shape; stored as-is
    const videoContent = { url: 'https://youtu.be/abc', provider: 'youtube' };
    const afterSwitch = await inOrgA(() =>
      programs.updateLesson(lesson.id, { type: 'video', content: videoContent }),
    );
    assert.equal(afterSwitch.type, 'video');
    assert.deepEqual(
      afterSwitch.content,
      videoContent,
      'content for the new type replaces the old shape (no deep validation)',
    );

    // nested/arbitrary quiz shape also round-trips untouched
    const quizContent = { questions: [{ q: '2+2?', options: [3, 4], answer: 1 }] };
    const afterQuiz = await inOrgA(() =>
      programs.updateLesson(lesson.id, { type: 'quiz', content: quizContent }),
    );
    assert.deepEqual(afterQuiz.content, quizContent);

    const bLesson = await seedLessonInOrgB();
    await assert.rejects(
      () => inOrgA(() => programs.updateLesson(bLesson, { title: 'hijack' })),
      NotFoundException,
    );
  });

  it('deleteLesson() removes it and 404s cross-org', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    const lesson = await inOrgA(() => programs.createLesson(mod.id, { title: 'L', type: 'text' }));
    await inOrgA(() => programs.deleteLesson(lesson.id));
    assert.equal(await raw.lesson.findUnique({ where: { id: lesson.id } }), null);
    const bLesson = await seedLessonInOrgB();
    await assert.rejects(() => inOrgA(() => programs.deleteLesson(bLesson)), NotFoundException);
  });

  it('moveLesson() swaps order with the adjacent lesson', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    const a = await inOrgA(() => programs.createLesson(mod.id, { title: 'A', type: 'text' }));
    const b = await inOrgA(() => programs.createLesson(mod.id, { title: 'B', type: 'text' }));

    await inOrgA(() => programs.moveLesson(b.id, 'up')); // B<->A
    assert.equal((await raw.lesson.findUniqueOrThrow({ where: { id: a.id } })).order, 1);
    assert.equal((await raw.lesson.findUniqueOrThrow({ where: { id: b.id } })).order, 0);

    // boundary no-op
    await inOrgA(() => programs.moveLesson(b.id, 'up'));
    assert.equal((await raw.lesson.findUniqueOrThrow({ where: { id: b.id } })).order, 0);
  });

  it('controllers reject bad enums (unlockMode, unlockDays, lessonType, direction)', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    assert.throws(
      () => modulesController.update('x', { unlockMode: 'sometimes' as never }),
      BadRequestException,
      'bad unlockMode rejected',
    );
    assert.throws(
      () => modulesController.update('x', { unlockDays: 0 }),
      BadRequestException,
      'unlockDays < 1 rejected',
    );
    assert.throws(
      () => modulesController.move('x', { direction: 'sideways' as never }),
      BadRequestException,
      'bad module move direction rejected',
    );
    assert.throws(
      () => modulesController.createLesson('x', { title: 'L', type: 'hologram' as never }),
      BadRequestException,
      'bad lesson type rejected',
    );
    assert.throws(
      () => lessonsController.move('x', { direction: 'sideways' as never }),
      BadRequestException,
      'bad lesson move direction rejected',
    );
  });

  // ⭐ ADR-014: every Module/Lesson mutation must bump the parent Program's
  // updatedAt — the whole "has unpublished changes" mechanism. Assert it moves
  // forward across create/patch/move/delete for BOTH modules and lessons.
  it('bumps parent Program.updatedAt on every module + lesson mutation', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    let last = (await readProgram(program.id)).updatedAt;
    // Assert the program's updatedAt advanced past `last`, then adopt the new value.
    const assertBumped = async (label: string) => {
      await sleep(5);
      const now = (await readProgram(program.id)).updatedAt;
      assert.ok(
        now.getTime() > last.getTime(),
        `${label} must bump parent Program.updatedAt (was ${last.toISOString()}, now ${now.toISOString()})`,
      );
      last = now;
    };

    await sleep(5);
    const modA = await inOrgA(() => programs.createModule(program.id, { title: 'A' }));
    await assertBumped('createModule');

    await inOrgA(() => programs.createModule(program.id, { title: 'B' }));
    await assertBumped('createModule (2nd, for move)');

    await inOrgA(() => programs.updateModule(modA.id, { description: 'x' }));
    await assertBumped('updateModule');

    await inOrgA(() => programs.moveModule(modA.id, 'down'));
    await assertBumped('moveModule');

    const lessonA = await inOrgA(() =>
      programs.createLesson(modA.id, { title: 'La', type: 'text' }),
    );
    await assertBumped('createLesson');

    await inOrgA(() => programs.createLesson(modA.id, { title: 'Lb', type: 'text' }));
    await assertBumped('createLesson (2nd, for move)');

    await inOrgA(() => programs.updateLesson(lessonA.id, { content: { body: 'hi' } }));
    await assertBumped('updateLesson');

    await inOrgA(() => programs.moveLesson(lessonA.id, 'down'));
    await assertBumped('moveLesson');

    await inOrgA(() => programs.deleteLesson(lessonA.id));
    await assertBumped('deleteLesson');

    await inOrgA(() => programs.deleteModule(modA.id));
    await assertBumped('deleteModule');
  });
});

describe('ProgramsService — Publish / Unpublish (slice 3, needs Postgres)', () => {
  const freshProgram = () =>
    inOrgA(() =>
      programs.createProgram(creatorPrincipal, {
        title: 'Publishable program',
        shape: 'self_paced',
        visibility: 'public',
      }),
    );

  /** A program with one visible module carrying one lesson → publishable. */
  async function seedPublishable() {
    const program = await freshProgram();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M' }));
    await inOrgA(() => programs.createLesson(mod.id, { title: 'L', type: 'text' }));
    return program;
  }

  it('publish() rejects an empty program (no modules)', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    await assert.rejects(
      () => inOrgA(() => programs.publishProgram(program.id)),
      (err: unknown) => {
        assert.ok(err instanceof BadRequestException);
        assert.equal((err.getResponse() as { code: string }).code, 'program_not_publishable');
        return true;
      },
    );
    assert.equal((await readProgram(program.id)).status, 'draft', 'stays draft on failed publish');
  });

  it('publish() rejects when the only module has no lessons', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    await inOrgA(() => programs.createModule(program.id, { title: 'Empty module' }));
    await assert.rejects(
      () => inOrgA(() => programs.publishProgram(program.id)),
      BadRequestException,
      'a module with zero lessons is not publishable',
    );
  });

  it('publish() rejects when every module with a lesson is hidden', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await freshProgram();
    const hidden = await inOrgA(() => programs.createModule(program.id, { title: 'Hidden' }));
    await inOrgA(() => programs.updateModule(hidden.id, { unlockMode: 'hidden' }));
    await inOrgA(() => programs.createLesson(hidden.id, { title: 'L', type: 'text' }));
    await assert.rejects(
      () => inOrgA(() => programs.publishProgram(program.id)),
      BadRequestException,
      'a hidden module (even with a lesson) does not satisfy the gate',
    );
  });

  it('publish() takes a valid program live with publishedAt set + no unpublished changes', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await seedPublishable();
    const published = await inOrgA(() => programs.publishProgram(program.id));
    assert.equal(published.status, 'published');
    assert.ok(published.publishedAt, 'publishedAt is set on publish');
    assert.equal(
      published.hasUnpublishedChanges,
      false,
      'a freshly published program has no unpublished changes',
    );
  });

  it('editing a lesson after publish flips hasUnpublishedChanges true; re-publish clears it + bumps publishedAt', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await seedPublishable();
    const mod = await inOrgA(() => programs.createModule(program.id, { title: 'M2' }));
    const lesson = await inOrgA(() => programs.createLesson(mod.id, { title: 'L2', type: 'text' }));
    const firstPublish = await inOrgA(() => programs.publishProgram(program.id));
    assert.equal(firstPublish.hasUnpublishedChanges, false);
    const firstPublishedAt = firstPublish.publishedAt;
    assert.ok(firstPublishedAt);

    await sleep(10);
    // Editing a lesson bumps the parent Program.updatedAt past publishedAt.
    await inOrgA(() => programs.updateLesson(lesson.id, { content: { body: 'edited' } }));
    const afterEdit = await inOrgA(() => programs.getProgramDetail(program.id));
    assert.equal(afterEdit.status, 'published', 'still published while editing');
    assert.equal(afterEdit.hasUnpublishedChanges, true, 'an edit after publish lights the badge');

    await sleep(10);
    const rePublish = await inOrgA(() => programs.publishProgram(program.id));
    assert.equal(rePublish.hasUnpublishedChanges, false, 're-publish clears the badge');
    assert.ok(
      new Date(rePublish.publishedAt!).getTime() > new Date(firstPublishedAt).getTime(),
      're-publish bumps publishedAt forward',
    );
  });

  it('unpublish() returns to draft but keeps publishedAt; idempotent when already draft', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    const program = await seedPublishable();
    const published = await inOrgA(() => programs.publishProgram(program.id));
    const publishedAt = published.publishedAt;
    assert.ok(publishedAt);

    const unpublished = await inOrgA(() => programs.unpublishProgram(program.id));
    assert.equal(unpublished.status, 'draft');
    assert.equal(unpublished.publishedAt, publishedAt, 'publishedAt is retained as "last live"');
    assert.equal(unpublished.hasUnpublishedChanges, false, 'a draft never has unpublished changes');

    // Idempotent: unpublishing an already-draft program is a no-op.
    const again = await inOrgA(() => programs.unpublishProgram(program.id));
    assert.equal(again.status, 'draft');
    assert.equal(again.publishedAt, publishedAt, 'publishedAt still retained on repeat unpublish');
  });

  it('publish()/unpublish() 404 for another org’s program', async (t) => {
    if (!dbAvailable) return t.skip('no reachable Postgres at DATABASE_URL');
    await assert.rejects(
      () => inOrgA(() => programs.publishProgram(orgB.programId)),
      NotFoundException,
    );
    await assert.rejects(
      () => inOrgA(() => programs.unpublishProgram(orgB.programId)),
      NotFoundException,
    );
  });
});

// Distinct `order` per ORG_B seed module — the `@@unique([programId, order])`
// constraint means two seeds on the same program must not reuse an order.
let orgBSeedOrder = 200;

/** Seed a lesson (+ module) in ORG_B; returns the lesson id. */
async function seedLessonInOrgB(): Promise<string> {
  const mod = await raw.module.create({
    data: {
      organisationId: ORG_B,
      programId: orgB.programId,
      title: 'B-mod',
      order: orgBSeedOrder++,
    },
  });
  const lesson = await raw.lesson.create({
    data: { organisationId: ORG_B, moduleId: mod.id, title: 'B-lesson', type: 'text', order: 0 },
  });
  return lesson.id;
}
