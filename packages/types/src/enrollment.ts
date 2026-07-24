import type { EnrollmentState } from './enrollment-state';
import type { ProgramShape } from './program-shape';
import type { ProgramVisibility } from './program-visibility';

// Shared enrollment DTOs (Sprint 2). Live here so the NestJS API and the
// apps/creator BFF cannot drift on the wire shape.

/** Request body for `POST /enrollment/invite`. */
export interface InviteLearnerRequest {
  programId: string;
  /** The cohort the learner lands in, or `null` for a self-paced program. */
  cohortId: string | null;
  phone: string;
  name?: string;
}

export interface EnrollmentSummary {
  id: string;
  learnerId: string;
  name: string;
  phone: string;
  state: EnrollmentState;
  /** ISO 8601. Present once approved (or auto-active for a public program). */
  approvedAt: string | null;
  /** ISO 8601. */
  enrolledAt: string;
}

export interface ProgramSummary {
  id: string;
  title: string;
  shape: ProgramShape;
  visibility: ProgramVisibility;
}

export interface RosterCohort {
  /** `'_all'` for a self-paced program's single synthetic roster bucket. */
  id: string;
  name: string;
  schedule?: string;
  roster: Array<{
    name: string;
    progressPercent: number;
    state: EnrollmentState;
  }>;
}

/** Result of `GET /enrollment/roster?programId=`. */
export interface RosterResponse {
  program: ProgramSummary;
  cohorts: RosterCohort[];
  /** Pending-approval entries for this program, across all cohorts. */
  pending: Array<{ id: string; name: string; phone: string; hoursAgo: number }>;
}
