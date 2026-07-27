import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateLessonRequest,
  CreateModuleRequest,
  CreateProgramRequest,
  LessonDetail,
  ModuleDetail,
  MoveDirection,
  Principal,
  ProgramCreated,
  ProgramDetail,
  ProgramSummary,
  UpdateLessonRequest,
  UpdateModuleRequest,
  UpdateProgramRequest,
} from '@fundi/types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma';

// A `module` / `lesson` row as Prisma returns it, narrowed to just the fields
// the *Detail mappers read (keeps the mappers independent of the generated
// model type without pulling the whole Prisma namespace into signatures).
type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  unlockMode: ModuleDetail['unlockMode'];
  unlockDays: number | null;
};
type LessonRow = {
  id: string;
  title: string;
  type: LessonDetail['type'];
  order: number;
  content: Prisma.JsonValue | null;
};

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Org-scoped list for the creator home grid. Enriched (feature 0012) with the
   * draft/publish `status`, the generative `coverStyle`, and two rollups the
   * cards render: `moduleCount` (modules in the program) and `learnerCount`
   * (its `active` enrollments). Counts come from Prisma's relation `_count`
   * with a per-relation `where`, so the whole grid is one query.
   */
  async listPrograms(): Promise<ProgramSummary[]> {
    const programs = await this.prisma.client.program.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            modules: true,
            enrollments: { where: { state: 'active' } },
          },
        },
      },
    });
    return programs.map((p) => ({
      id: p.id,
      title: p.title,
      shape: p.shape,
      visibility: p.visibility,
      status: p.status,
      coverStyle: p.coverStyle,
      moduleCount: p._count.modules,
      learnerCount: p._count.enrollments,
    }));
  }

  /**
   * `POST /programs` — create a **draft** program. The `ownerMentorId` is
   * resolved from the principal's creator Membership in the current org (a
   * creator membership carries a `mentorId`); an account with no such
   * membership is not a creator here and is rejected with `not_a_creator`.
   *
   * `organisationId` is auto-stamped by the org-scope extension; the value is
   * passed explicitly only to satisfy Prisma's create-input type (it matches
   * the bound context, so the stamp is idempotent — same pattern as
   * AuthService.onboard / EnrollmentService.invite).
   */
  async createProgram(principal: Principal, input: CreateProgramRequest): Promise<ProgramCreated> {
    const organisationId = principal.org;
    if (!organisationId) {
      throw new ForbiddenException({
        code: 'not_a_creator',
        message: 'This account cannot create programs.',
      });
    }

    // Membership is non-tenant-scoped (readable pre-context), so it is queried
    // by its full composite key rather than relying on org injection.
    const membership = await this.prisma.client.membership.findUnique({
      where: { accountId_organisationId: { accountId: principal.accountId, organisationId } },
    });
    if (!membership?.mentorId) {
      throw new ForbiddenException({
        code: 'not_a_creator',
        message: 'This account cannot create programs.',
      });
    }

    const program = await this.prisma.client.program.create({
      data: {
        organisationId,
        ownerMentorId: membership.mentorId,
        title: input.title,
        description: input.description ?? null,
        shape: input.shape,
        visibility: input.visibility,
        coverStyle: input.coverStyle ?? 'gradient',
        status: 'draft',
      },
    });

    return {
      id: program.id,
      title: program.title,
      description: program.description,
      shape: program.shape,
      visibility: program.visibility,
      status: program.status,
      coverStyle: program.coverStyle,
    };
  }

  /**
   * `GET /programs/:id` — full detail (program + ordered modules + ordered
   * lessons) for the builder to load. Org-scoped `findUnique` → the row is null
   * for a missing id AND for another org's id (the scope makes them
   * indistinguishable, which is correct), both surfaced as `program_not_found`.
   */
  async getProgramDetail(programId: string): Promise<ProgramDetail> {
    const program = await this.prisma.client.program.findUnique({
      where: { id: programId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!program) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    return {
      id: program.id,
      title: program.title,
      description: program.description,
      shape: program.shape,
      visibility: program.visibility,
      status: program.status,
      coverStyle: program.coverStyle,
      publishedAt: program.publishedAt ? program.publishedAt.toISOString() : null,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
      // "Unpublished changes" (ADR-014): only meaningful once live — a published
      // program edited since its last publish. A draft (or never-published)
      // program is always `false`. Publish sets `publishedAt === updatedAt`, so
      // a strict `>` is `false` immediately after publishing.
      hasUnpublishedChanges:
        program.status === 'published' && program.publishedAt != null
          ? program.updatedAt.getTime() > program.publishedAt.getTime()
          : false,
      modules: program.modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        unlockMode: m.unlockMode,
        unlockDays: m.unlockDays,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          order: l.order,
          content: l.content ?? null,
        })),
      })),
    };
  }

  /**
   * `PATCH /programs/:id` — autosave the setup fields (any subset). Existence is
   * checked first via the org-scoped read so a missing/cross-org id is a clean
   * `program_not_found` rather than a Prisma P2025. `updatedAt` bumps
   * automatically (Prisma `@updatedAt`). Returns the full refreshed detail.
   */
  async updateProgram(programId: string, input: UpdateProgramRequest): Promise<ProgramDetail> {
    const existing = await this.prisma.client.program.findUnique({ where: { id: programId } });
    if (!existing) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    await this.prisma.client.program.update({
      where: { id: programId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.shape !== undefined ? { shape: input.shape } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.coverStyle !== undefined ? { coverStyle: input.coverStyle } : {}),
      },
    });
    return this.getProgramDetail(programId);
  }

  /**
   * `POST /programs/:id/publish` — take a program live (feature 0012 slice 3 /
   * ADR-014). Gate: at least one **visible** module (`unlockMode != 'hidden'`)
   * carrying at least one lesson — otherwise `400 program_not_publishable`.
   * On success: `status: published`, `publishedAt: now`. `publishedAt` and
   * `updatedAt` are stamped with the SAME instant so the freshly published
   * program reads `hasUnpublishedChanges: false` (Prisma's `@updatedAt` is
   * overridden explicitly — otherwise it would land a few ms after our
   * `publishedAt` and light the badge on a program with no real edits).
   * 404 (`program_not_found`) for a missing/cross-org id.
   */
  async publishProgram(programId: string): Promise<ProgramDetail> {
    const program = await this.prisma.client.program.findUnique({
      where: { id: programId },
      include: { modules: { include: { lessons: { select: { id: true } } } } },
    });
    if (!program) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    const publishable = program.modules.some(
      (m) => m.unlockMode !== 'hidden' && m.lessons.length > 0,
    );
    if (!publishable) {
      throw new BadRequestException({
        code: 'program_not_publishable',
        message: 'Add at least one visible module with a lesson before publishing.',
      });
    }
    const now = new Date();
    await this.prisma.client.program.update({
      where: { id: programId },
      data: { status: 'published', publishedAt: now, updatedAt: now },
    });
    return this.getProgramDetail(programId);
  }

  /**
   * `POST /programs/:id/unpublish` — return a live program to `draft`. Does
   * **not** clear `publishedAt` (kept as "last live" history — ADR-014).
   * Idempotent: unpublishing an already-draft program is a no-op that still
   * returns the current detail. 404 (`program_not_found`) cross-org.
   */
  async unpublishProgram(programId: string): Promise<ProgramDetail> {
    const existing = await this.prisma.client.program.findUnique({ where: { id: programId } });
    if (!existing) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    if (existing.status !== 'draft') {
      // publishedAt is deliberately left untouched.
      await this.prisma.client.program.update({
        where: { id: programId },
        data: { status: 'draft' },
      });
    }
    return this.getProgramDetail(programId);
  }

  // ---------------------------------------------------------------------------
  // Module CRUD + reorder (feature 0012 slice 2)
  //
  // EVERY mutation below also bumps the owning Program's `updatedAt` in the SAME
  // transaction as the write (ADR-014 / TDD 0002): Prisma's `@updatedAt` only
  // fires when the Program row itself is written, so child Module/Lesson edits
  // are invisible to the "has unpublished changes" check unless we touch the
  // parent explicitly. The owning `programId` is resolved from the Module row
  // (Module.programId) or, for Lessons, from the Lesson's Module. Silent if
  // wrong — hence the dedicated updatedAt-aggregate test.
  // ---------------------------------------------------------------------------

  /**
   * `POST /programs/:id/modules` — append a module. `order` is `max(order)+1`
   * within the program, or `0` for the first. `unlockMode` defaults to
   * `immediate` (schema default). 404 if the program is missing/another org's.
   */
  async createModule(programId: string, input: CreateModuleRequest): Promise<ModuleDetail> {
    const program = await this.prisma.client.program.findUnique({ where: { id: programId } });
    if (!program) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    const created = await this.prisma.client.$transaction(async (tx) => {
      const agg = await tx.module.aggregate({ where: { programId }, _max: { order: true } });
      const nextOrder = agg._max.order == null ? 0 : agg._max.order + 1;
      const mod = await tx.module.create({
        // organisationId is auto-stamped by the org-scope extension; it is
        // passed explicitly only to satisfy Prisma's create-input type and is
        // idempotent against the bound context (same pattern as createProgram).
        data: {
          organisationId: program.organisationId,
          programId,
          title: input.title,
          order: nextOrder,
        },
      });
      await tx.program.update({ where: { id: programId }, data: { updatedAt: new Date() } });
      return mod;
    });
    return this.toModuleDetail(created, []);
  }

  /**
   * `PATCH /modules/:id` — autosave a subset of the module's settings. 404 if
   * the module is missing/another org's. Bumps the parent Program.
   */
  async updateModule(moduleId: string, input: UpdateModuleRequest): Promise<ModuleDetail> {
    const existing = await this.prisma.client.module.findUnique({ where: { id: moduleId } });
    if (!existing) {
      throw new NotFoundException({ code: 'module_not_found', message: 'Module not found.' });
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.module.update({
        where: { id: moduleId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.unlockMode !== undefined ? { unlockMode: input.unlockMode } : {}),
          ...(input.unlockDays !== undefined ? { unlockDays: input.unlockDays } : {}),
        },
      });
      await tx.program.update({
        where: { id: existing.programId },
        data: { updatedAt: new Date() },
      });
    });
    return this.getModuleDetail(moduleId);
  }

  /**
   * `DELETE /modules/:id` — hard-delete; the schema's `onDelete: Cascade` drops
   * the module's lessons. 404 cross-org. Bumps the parent Program.
   */
  async deleteModule(moduleId: string): Promise<void> {
    const existing = await this.prisma.client.module.findUnique({ where: { id: moduleId } });
    if (!existing) {
      throw new NotFoundException({ code: 'module_not_found', message: 'Module not found.' });
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.module.delete({ where: { id: moduleId } });
      await tx.program.update({
        where: { id: existing.programId },
        data: { updatedAt: new Date() },
      });
    });
  }

  /**
   * `POST /modules/:id/move` — swap `order` with the adjacent sibling module in
   * the same program (`up` = previous, `down` = next). No-op at the boundary.
   * 404 cross-org. Bumps the parent Program when a swap happens.
   */
  async moveModule(moduleId: string, direction: MoveDirection): Promise<void> {
    const current = await this.prisma.client.module.findUnique({ where: { id: moduleId } });
    if (!current) {
      throw new NotFoundException({ code: 'module_not_found', message: 'Module not found.' });
    }
    const sibling = await this.prisma.client.module.findFirst({
      where: {
        programId: current.programId,
        order: direction === 'up' ? { lt: current.order } : { gt: current.order },
      },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!sibling) return; // already at the boundary — no-op
    const a = current.order;
    const b = sibling.order;
    await this.prisma.client.$transaction(async (tx) => {
      // Three-step swap via a negative sentinel: the `@@unique([programId,
      // order])` constraint is checked per-statement, so a direct A<->B swap
      // would transiently collide. Orders are always >= 0, so -1 is safe.
      await tx.module.update({ where: { id: current.id }, data: { order: -1 } });
      await tx.module.update({ where: { id: sibling.id }, data: { order: a } });
      await tx.module.update({ where: { id: current.id }, data: { order: b } });
      await tx.program.update({
        where: { id: current.programId },
        data: { updatedAt: new Date() },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Lesson CRUD + reorder (feature 0012 slice 2)
  // ---------------------------------------------------------------------------

  /**
   * `POST /modules/:id/lessons` — append a lesson. `order` = `max(order)+1` in
   * the module (or 0); `content` defaults to `{}`. 404 if the module is
   * missing/another org's. Bumps the parent Program (resolved via the module).
   */
  async createLesson(moduleId: string, input: CreateLessonRequest): Promise<LessonDetail> {
    const mod = await this.prisma.client.module.findUnique({ where: { id: moduleId } });
    if (!mod) {
      throw new NotFoundException({ code: 'module_not_found', message: 'Module not found.' });
    }
    const created = await this.prisma.client.$transaction(async (tx) => {
      const agg = await tx.lesson.aggregate({ where: { moduleId }, _max: { order: true } });
      const nextOrder = agg._max.order == null ? 0 : agg._max.order + 1;
      const lesson = await tx.lesson.create({
        // organisationId auto-stamped by the org-scope extension; passed only
        // to satisfy Prisma's create-input type (idempotent — see createModule).
        data: {
          organisationId: mod.organisationId,
          moduleId,
          title: input.title,
          type: input.type,
          order: nextOrder,
          content: {},
        },
      });
      await tx.program.update({ where: { id: mod.programId }, data: { updatedAt: new Date() } });
      return lesson;
    });
    return this.toLessonDetail(created);
  }

  /**
   * `PATCH /lessons/:id` — autosave a subset. `content` is stored verbatim
   * (JSONB) — whatever shape the client sends for the (possibly switched)
   * `type`; the API does not deep-validate content. 404 cross-org. Bumps the
   * parent Program (resolved via the lesson's module).
   */
  async updateLesson(lessonId: string, input: UpdateLessonRequest): Promise<LessonDetail> {
    const existing = await this.prisma.client.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'lesson_not_found', message: 'Lesson not found.' });
    }
    const data: Prisma.LessonUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.type !== undefined) data.type = input.type;
    // Presence of the `content` key (even `null`) means "set it". A JS `null`
    // maps to SQL NULL; any other value is stored as-is.
    if ('content' in input) {
      data.content =
        input.content === null || input.content === undefined
          ? Prisma.DbNull
          : (input.content as Prisma.InputJsonValue);
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id: lessonId }, data });
      await tx.program.update({
        where: { id: existing.module.programId },
        data: { updatedAt: new Date() },
      });
    });
    return this.getLessonDetail(lessonId);
  }

  /** `DELETE /lessons/:id`. 404 cross-org. Bumps the parent Program. */
  async deleteLesson(lessonId: string): Promise<void> {
    const existing = await this.prisma.client.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'lesson_not_found', message: 'Lesson not found.' });
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.lesson.delete({ where: { id: lessonId } });
      await tx.program.update({
        where: { id: existing.module.programId },
        data: { updatedAt: new Date() },
      });
    });
  }

  /**
   * `POST /lessons/:id/move` — swap `order` with the adjacent lesson in the same
   * module. No-op at the boundary. 404 cross-org. Bumps the parent Program.
   */
  async moveLesson(lessonId: string, direction: MoveDirection): Promise<void> {
    const current = await this.prisma.client.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    });
    if (!current) {
      throw new NotFoundException({ code: 'lesson_not_found', message: 'Lesson not found.' });
    }
    const sibling = await this.prisma.client.lesson.findFirst({
      where: {
        moduleId: current.moduleId,
        order: direction === 'up' ? { lt: current.order } : { gt: current.order },
      },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!sibling) return; // boundary — no-op
    const a = current.order;
    const b = sibling.order;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id: current.id }, data: { order: -1 } });
      await tx.lesson.update({ where: { id: sibling.id }, data: { order: a } });
      await tx.lesson.update({ where: { id: current.id }, data: { order: b } });
      await tx.program.update({
        where: { id: current.module.programId },
        data: { updatedAt: new Date() },
      });
    });
  }

  // --- read helpers + mappers ------------------------------------------------

  /** Org-scoped module + its ordered lessons, shaped as `ModuleDetail`. */
  private async getModuleDetail(moduleId: string): Promise<ModuleDetail> {
    const mod = await this.prisma.client.module.findUnique({
      where: { id: moduleId },
      include: { lessons: { orderBy: { order: 'asc' } } },
    });
    if (!mod) {
      throw new NotFoundException({ code: 'module_not_found', message: 'Module not found.' });
    }
    return this.toModuleDetail(mod, mod.lessons);
  }

  /** Org-scoped lesson, shaped as `LessonDetail`. */
  private async getLessonDetail(lessonId: string): Promise<LessonDetail> {
    const lesson = await this.prisma.client.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException({ code: 'lesson_not_found', message: 'Lesson not found.' });
    }
    return this.toLessonDetail(lesson);
  }

  private toModuleDetail(m: ModuleRow, lessons: LessonRow[]): ModuleDetail {
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      unlockMode: m.unlockMode,
      unlockDays: m.unlockDays,
      lessons: lessons.map((l) => this.toLessonDetail(l)),
    };
  }

  private toLessonDetail(l: LessonRow): LessonDetail {
    return {
      id: l.id,
      title: l.title,
      type: l.type,
      order: l.order,
      content: l.content ?? null,
    };
  }

  /**
   * Org-scoped program + its cohorts, for the roster endpoint. Throws if the
   * program doesn't exist (or belongs to another org — the org-scoped client
   * makes those two cases indistinguishable, which is the correct behaviour).
   */
  async getProgramWithCohorts(programId: string) {
    const program = await this.prisma.client.program.findUnique({
      where: { id: programId },
      include: { cohorts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!program) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    return program;
  }
}
