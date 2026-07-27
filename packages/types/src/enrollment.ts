import type { EnrollmentState } from './enrollment-state';
import type { ProgramShape } from './program-shape';
import type { ProgramVisibility } from './program-visibility';
import type { ProgramStatus } from './program-status';
import type { ProgramCoverStyle } from './program-cover-style';

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

/**
 * Program card shape for the creator home grid (feature 0012). Enriched beyond
 * the original id/title/shape/visibility with the draft/publish `status`, the
 * generative `coverStyle`, and two rollup counts the home cards render.
 */
export interface ProgramSummary {
  id: string;
  title: string;
  shape: ProgramShape;
  visibility: ProgramVisibility;
  status: ProgramStatus;
  coverStyle: ProgramCoverStyle;
  /** Number of modules in the program. */
  moduleCount: number;
  /** Number of `active` enrollments (roster size). */
  learnerCount: number;
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
  // The roster header only needs the program's identity, not the home-card
  // rollups (moduleCount/learnerCount) — narrowed so the roster path never has
  // to compute counts it doesn't render.
  program: Pick<ProgramSummary, 'id' | 'title' | 'shape' | 'visibility'>;
  cohorts: RosterCohort[];
  /** Pending-approval entries for this program, across all cohorts. */
  pending: Array<{ id: string; name: string; phone: string; hoursAgo: number }>;
}
