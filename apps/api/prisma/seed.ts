import { PrismaClient } from '@prisma/client';

/**
 * Dev/test fixture seed (Sprint 2 bridging story, 86capbyc3). Program Builder
 * UI is blocked on missing design files, so this is the only way a Program
 * exists to enroll into / build a roster against until that lands.
 *
 * Idempotent: if the fixed-id demo org already exists, this is a no-op — safe
 * to re-run (`pnpm --filter api db:seed`) without clobbering enrollment state
 * exercised against it in the meantime.
 *
 * Creates one self_paced/public program (auto-active enrollment path) and one
 * cohort/private program with two cohorts (approval-gated enrollment path),
 * so both Enrollment paths described in the Sprint 2 AC are testable.
 */

const raw = new PrismaClient();

const SEED_ORG_ID = 'seed_demo_org';

async function main(): Promise<void> {
  const existing = await raw.organisation.findUnique({ where: { id: SEED_ORG_ID } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`[seed] "${existing.name}" already exists (${SEED_ORG_ID}) — skipping.`);
    return;
  }

  const org = await raw.organisation.create({
    data: { id: SEED_ORG_ID, name: 'Fundi Demo Org' },
  });

  const mentor = await raw.mentor.create({
    data: {
      organisationId: org.id,
      name: 'Ama Owusu',
      phone: '+233240000001',
      role: 'owner',
    },
  });

  // --- Program 1: self-paced, public — invite lands `active` immediately.
  const publicProgram = await raw.program.create({
    data: {
      organisationId: org.id,
      ownerMentorId: mentor.id,
      title: 'Foundations of Baking',
      description: 'A self-paced intro course, open to anyone.',
      shape: 'self_paced',
      visibility: 'public',
    },
  });

  const publicModule = await raw.module.create({
    data: {
      organisationId: org.id,
      programId: publicProgram.id,
      title: 'Getting started',
      order: 1,
    },
  });

  await raw.lesson.createMany({
    data: [
      {
        organisationId: org.id,
        moduleId: publicModule.id,
        title: 'Welcome & kitchen setup',
        type: 'text',
        order: 1,
        content: { body: 'Before you start, here is what you need in your kitchen.' },
      },
      {
        organisationId: org.id,
        moduleId: publicModule.id,
        title: 'Your first loaf',
        type: 'video',
        order: 2,
        content: { url: 'https://example.com/first-loaf.mp4', durationSeconds: 480 },
      },
    ],
  });

  // --- Program 2: cohort, private — invite lands `pending_approval`.
  const privateProgram = await raw.program.create({
    data: {
      organisationId: org.id,
      ownerMentorId: mentor.id,
      title: 'Advanced Pastry Cohort',
      description: 'A cohort-based, approval-gated program.',
      shape: 'cohort',
      visibility: 'private',
    },
  });

  const [cohortA, cohortB] = await Promise.all([
    raw.cohort.create({
      data: {
        organisationId: org.id,
        programId: privateProgram.id,
        name: 'Cohort A — Jan 2026',
        startDate: new Date('2026-01-15T00:00:00Z'),
        timezone: 'Africa/Accra',
      },
    }),
    raw.cohort.create({
      data: {
        organisationId: org.id,
        programId: privateProgram.id,
        name: 'Cohort B — Mar 2026',
        startDate: new Date('2026-03-01T00:00:00Z'),
        timezone: 'Africa/Accra',
      },
    }),
  ]);

  const privateModule = await raw.module.create({
    data: {
      organisationId: org.id,
      programId: privateProgram.id,
      title: 'Laminated dough',
      order: 1,
    },
  });

  await raw.lesson.createMany({
    data: [
      {
        organisationId: org.id,
        moduleId: privateModule.id,
        title: 'Live demo: croissant lamination',
        type: 'live_online',
        order: 1,
        content: { platform: 'zoom' },
      },
      {
        organisationId: org.id,
        moduleId: privateModule.id,
        title: 'Reference recipe sheet',
        type: 'attachment',
        order: 2,
        content: { fileName: 'lamination-ratios.pdf' },
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log(
    `[seed] Created "${org.name}": ` +
      `"${publicProgram.title}" (public/self_paced), ` +
      `"${privateProgram.title}" (private/cohort, cohorts: "${cohortA.name}", "${cohortB.name}").`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => raw.$disconnect());
