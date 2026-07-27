import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LessonType, PrismaClient, ProgramShape, ProgramVisibility } from '@prisma/client';

/**
 * Seed a full demo program (org + owner creator + modules + lessons) from a
 * JSON fixture, so the Program Builder / creator app has real content to open
 * without hand-building one. Default fixture: `seeds/content-creation-101.json`
 * ("Content Creation 101" — 5 modules, 15 lessons across every lesson type);
 * pass a different path as `argv[2]` to seed another.
 *
 *   pnpm --filter api db:seed:demo
 *
 * Idempotent: if the fixture's Program id already exists, this is a no-op.
 *
 * Field mapping (fixture → schema): `status:"active"` → `published`
 * (+ `publishedAt`); `tagline` is folded into `description`; `estimated_minutes`
 * is folded into the lesson's JSONB `content`; `duration_weeks` is dropped
 * (no column). `message_templates`/`signals_demo` are intentionally skipped —
 * they belong to the not-yet-built Messaging/Triage domains.
 *
 * To VIEW the seeded program in the creator app, log in as the demo creator
 * phone printed at the end (with `OTP_DELIVERY_DRIVER=stub`, the code prints to
 * the API console) — the org is scoped, so only a member of it sees the program.
 */

const raw = new PrismaClient();

const DEMO_CREATOR_PHONE = '+233200000101';

interface SeedLesson {
  id: string;
  order: number;
  type: string;
  title: string;
  estimated_minutes?: number;
  content?: Record<string, unknown>;
}
interface SeedModule {
  id: string;
  order: number;
  title: string;
  lessons: SeedLesson[];
}
interface SeedFile {
  organisation: { id: string; name: string };
  program: {
    id: string;
    title: string;
    tagline?: string;
    description?: string;
    shape: string;
    visibility: string;
    status: string;
    modules: SeedModule[];
  };
}

function load(): SeedFile {
  const path = process.argv[2] ?? join(__dirname, 'seeds', 'content-creation-101.json');
  return JSON.parse(readFileSync(path, 'utf8')) as SeedFile;
}

async function main(): Promise<void> {
  const { organisation: orgSeed, program: progSeed } = load();

  const existingProgram = await raw.program.findUnique({ where: { id: progSeed.id } });
  if (existingProgram) {
    // eslint-disable-next-line no-console
    console.log(
      `[seed:demo] Program "${existingProgram.title}" (${progSeed.id}) already exists — skipping.`,
    );
    return;
  }

  // Org + a loginnable owner creator (Account → Membership → Mentor), all upserted
  // so a partial prior run or a shared org doesn't fail the re-run.
  const org = await raw.organisation.upsert({
    where: { id: orgSeed.id },
    create: { id: orgSeed.id, name: orgSeed.name },
    update: {},
  });

  const account = await raw.account.upsert({
    where: { phone: DEMO_CREATOR_PHONE },
    create: { phone: DEMO_CREATOR_PHONE },
    update: {},
  });

  let mentor = await raw.mentor.findFirst({
    where: { organisationId: org.id, phone: DEMO_CREATOR_PHONE },
  });
  if (!mentor) {
    mentor = await raw.mentor.create({
      data: {
        organisationId: org.id,
        name: 'Demo Creator',
        phone: DEMO_CREATOR_PHONE,
        role: 'owner',
      },
    });
  }

  await raw.membership.upsert({
    where: { accountId_organisationId: { accountId: account.id, organisationId: org.id } },
    create: { accountId: account.id, organisationId: org.id, role: 'owner', mentorId: mentor.id },
    update: { mentorId: mentor.id },
  });

  // Program — `active` fixture status maps to our `published` gate; tagline
  // becomes a lead line of the description.
  const description = progSeed.tagline
    ? `${progSeed.tagline}\n\n${progSeed.description ?? ''}`.trim()
    : (progSeed.description ?? null);

  await raw.program.create({
    data: {
      id: progSeed.id,
      organisationId: org.id,
      ownerMentorId: mentor.id,
      title: progSeed.title,
      description,
      shape: progSeed.shape as ProgramShape,
      visibility: progSeed.visibility as ProgramVisibility,
      status: 'published',
      publishedAt: new Date(),
    },
  });

  let moduleCount = 0;
  let lessonCount = 0;
  for (const mod of progSeed.modules) {
    await raw.module.create({
      data: {
        id: mod.id,
        organisationId: org.id,
        programId: progSeed.id,
        title: mod.title,
        order: mod.order,
      },
    });
    moduleCount += 1;

    if (mod.lessons.length > 0) {
      await raw.lesson.createMany({
        data: mod.lessons.map((lsn) => ({
          id: lsn.id,
          organisationId: org.id,
          moduleId: mod.id,
          title: lsn.title,
          type: lsn.type as LessonType,
          order: lsn.order,
          // JSONB content kept verbatim; estimated_minutes (no column) folded in.
          content: {
            ...(lsn.content ?? {}),
            ...(lsn.estimated_minutes != null ? { estimatedMinutes: lsn.estimated_minutes } : {}),
          },
        })),
      });
      lessonCount += mod.lessons.length;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[seed:demo] Created "${progSeed.title}" in "${org.name}" — ` +
      `${moduleCount} modules, ${lessonCount} lessons (published). ` +
      `Log in as the demo creator ${DEMO_CREATOR_PHONE} to open it in the builder.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('[seed:demo] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => raw.$disconnect());
