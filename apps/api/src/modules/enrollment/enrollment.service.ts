import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EnrollmentState } from '@fundi/types';
import type { EnrollmentSummary, RosterCohort, RosterResponse } from '@fundi/types';
import { PrismaService } from '../../prisma';
import { PhoneService } from '../auth';
import { ProgramsService } from '../programs';

interface LearnerLike {
  name: string | null;
  phone: string;
}

interface EnrollmentLike {
  id: string;
  learnerId: string;
  state: EnrollmentState;
  approvedAt: Date | null;
  enrolledAt: Date;
}

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phone: PhoneService,
    private readonly programs: ProgramsService,
  ) {}

  /**
   * Invite a learner by phone into a program. Public programs land `active`
   * immediately; private programs land `pending_approval` (Sprint 2 AC).
   * A `dropped` prior enrollment is reactivated; any other existing state
   * (pending/active/completed) is a conflict, not a silent duplicate.
   */
  async invite(
    programId: string,
    cohortId: string | null,
    phoneInput: string,
    name?: string,
  ): Promise<EnrollmentSummary> {
    const program = await this.programs.getProgramWithCohorts(programId);
    if (cohortId && !program.cohorts.some((c) => c.id === cohortId)) {
      throw new BadRequestException({
        code: 'invalid_cohort',
        message: 'That cohort does not belong to this program.',
      });
    }
    // A program with real Cohort rows must not accept a null cohortId: an
    // enrollment with no cohort would never appear in any of getRoster()'s
    // per-cohort buckets (only the cohort-less "no cohorts at all" case gets
    // the synthetic '_all' bucket) — silently enrolling a learner nobody can
    // then see defeats the whole point of inviting them.
    if (!cohortId && program.cohorts.length > 0) {
      throw new BadRequestException({
        code: 'cohort_required',
        message: 'This program has cohorts — pick one before inviting.',
      });
    }

    const phone = this.phone.normalize(phoneInput);
    const organisationId = program.organisationId;

    const learner = await this.prisma.client.learner.upsert({
      where: { organisationId_phone: { organisationId, phone } },
      update: name ? { name } : {},
      create: { organisationId, phone, name },
    });

    const initialState: EnrollmentState =
      program.visibility === 'public' ? 'active' : 'pending_approval';
    const now = new Date();

    const existing = await this.prisma.client.enrollment.findUnique({
      where: {
        organisationId_learnerId_programId: { organisationId, learnerId: learner.id, programId },
      },
    });

    let enrollment: EnrollmentLike;
    if (!existing) {
      enrollment = await this.prisma.client.enrollment.create({
        data: {
          organisationId,
          learnerId: learner.id,
          programId,
          cohortId,
          state: initialState,
          approvedAt: initialState === 'active' ? now : null,
        },
      });
    } else if (existing.state === 'dropped') {
      enrollment = await this.prisma.client.enrollment.update({
        where: { id: existing.id },
        data: {
          cohortId,
          state: initialState,
          approvedAt: initialState === 'active' ? now : null,
          enrolledAt: now,
        },
      });
    } else {
      throw new ConflictException({
        code: 'already_enrolled',
        message: `This learner already has a "${existing.state}" enrollment in this program.`,
      });
    }

    return this.toSummary(learner, enrollment);
  }

  /** pending_approval -> active. Throws if the enrollment isn't pending. */
  async approve(enrollmentId: string): Promise<EnrollmentSummary> {
    const existing = await this.findPendingOrThrow(enrollmentId);
    const updated = await this.prisma.client.enrollment.update({
      where: { id: enrollmentId },
      data: { state: 'active', approvedAt: new Date() },
    });
    return this.toSummary(existing.learner, updated);
  }

  /**
   * Hard-deletes the pending Enrollment row (PO-confirmed: "removes the
   * pending entry" is taken literally — no `declined` state exists in the
   * schema, and adding one was explicitly deferred). Only valid while the
   * enrollment is still pending; approved/completed/dropped rows are not
   * "declinable".
   */
  async decline(enrollmentId: string): Promise<void> {
    await this.findPendingOrThrow(enrollmentId);
    await this.prisma.client.enrollment.delete({ where: { id: enrollmentId } });
  }

  private async findPendingOrThrow(enrollmentId: string) {
    const existing = await this.prisma.client.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { learner: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'enrollment_not_found',
        message: 'Enrollment not found.',
      });
    }
    if (existing.state !== 'pending_approval') {
      throw new ConflictException({
        code: 'not_pending',
        message: `Enrollment is "${existing.state}", not pending_approval.`,
      });
    }
    return existing;
  }

  /**
   * Roster for a program, shaped directly for `CohortRosterProps`. Self-paced
   * programs (no real Cohort rows) get one synthetic `'_all'` bucket so the
   * same `CohortRoster` component renders both cases — see the Sprint 2
   * PO-flags doc for why this wasn't given a bespoke "hidden tab" layout.
   */
  async getRoster(programId: string): Promise<RosterResponse> {
    const program = await this.programs.getProgramWithCohorts(programId);

    const enrollments = await this.prisma.client.enrollment.findMany({
      where: { programId },
      include: { learner: true },
      orderBy: { enrolledAt: 'asc' },
    });

    const pending = enrollments
      .filter((e) => e.state === 'pending_approval')
      .map((e) => ({
        id: e.id,
        name: e.learner.name ?? e.learner.phone,
        phone: e.learner.phone,
        hoursAgo: Math.max(0, Math.round((Date.now() - e.enrolledAt.getTime()) / 3_600_000)),
      }));

    const active = enrollments.filter((e) => e.state !== 'pending_approval');
    const bucket = (cohortId: string | null) =>
      active
        .filter((e) => e.cohortId === cohortId)
        .map((e) => ({
          name: e.learner.name ?? e.learner.phone,
          // Progress domain isn't built yet (Sprint 3) — always 0 for now.
          progressPercent: 0,
          state: e.state,
        }));

    const cohorts: RosterCohort[] =
      program.cohorts.length > 0
        ? program.cohorts.map((c) => ({
            id: c.id,
            name: c.name,
            schedule: c.startDate ? c.startDate.toISOString() : undefined,
            roster: bucket(c.id),
          }))
        : [{ id: '_all', name: program.title, roster: bucket(null) }];

    return {
      program: {
        id: program.id,
        title: program.title,
        shape: program.shape,
        visibility: program.visibility,
      },
      cohorts,
      pending,
    };
  }

  private toSummary(learner: LearnerLike, enrollment: EnrollmentLike): EnrollmentSummary {
    return {
      id: enrollment.id,
      learnerId: enrollment.learnerId,
      name: learner.name ?? learner.phone,
      phone: learner.phone,
      state: enrollment.state,
      approvedAt: enrollment.approvedAt ? enrollment.approvedAt.toISOString() : null,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }
}
