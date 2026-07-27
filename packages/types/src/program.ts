import type { ProgramShape } from './program-shape';
import type { ProgramVisibility } from './program-visibility';
import type { ProgramStatus } from './program-status';
import type { ProgramCoverStyle } from './program-cover-style';
import type { ModuleUnlockMode } from './module-unlock-mode';
import type { LessonType } from './lesson-type';

// Shared Program Builder DTOs (feature 0012 / TDD 0002). Live here so the
// NestJS API and the apps/creator BFF cannot drift on the wire shape.

/** Body of `POST /programs` — create a draft program. */
export interface CreateProgramRequest {
  title: string;
  shape: ProgramShape;
  visibility: ProgramVisibility;
  description?: string;
  /** Defaults to `gradient` when omitted. */
  coverStyle?: ProgramCoverStyle;
}

/**
 * Body of `PATCH /programs/:id` — autosave from the setup stage. Every field is
 * optional; any subset may be sent. `updatedAt` bumps automatically.
 */
export interface UpdateProgramRequest {
  title?: string;
  description?: string;
  shape?: ProgramShape;
  visibility?: ProgramVisibility;
  coverStyle?: ProgramCoverStyle;
}

/** Body of `POST /programs/:id/modules` — append a module to a program. */
export interface CreateModuleRequest {
  title: string;
}

/**
 * Body of `PATCH /modules/:id` — autosave a module's settings. Any subset may
 * be sent. `unlockDays` is only meaningful when `unlockMode = after_days`;
 * `null` clears it.
 */
export interface UpdateModuleRequest {
  title?: string;
  description?: string | null;
  unlockMode?: ModuleUnlockMode;
  unlockDays?: number | null;
}

/** Body of `POST /modules/:id/lessons` — append a lesson to a module. */
export interface CreateLessonRequest {
  title: string;
  type: LessonType;
}

/**
 * Body of `PATCH /lessons/:id` — autosave a lesson. `content` is stored as-is
 * (JSONB); its shape is a client concern that varies by `type` — the API does
 * not deep-validate it.
 */
export interface UpdateLessonRequest {
  title?: string;
  type?: LessonType;
  /** Opaque JSONB payload; shape varies by `type`. */
  content?: unknown;
}

/** Direction for the `/move` swap-with-adjacent-sibling endpoints. */
export type MoveDirection = 'up' | 'down';

/** Body of `POST /modules/:id/move` and `POST /lessons/:id/move`. */
export interface MoveRequest {
  direction: MoveDirection;
}

/** Result of `POST /programs` — the freshly created draft. */
export interface ProgramCreated {
  id: string;
  title: string;
  description: string | null;
  shape: ProgramShape;
  visibility: ProgramVisibility;
  status: ProgramStatus;
  coverStyle: ProgramCoverStyle;
}

/** A lesson within a module, as returned by `GET /programs/:id`. */
export interface LessonDetail {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  /** JSONB content, shape varies by `type`; null until authored. */
  content: unknown | null;
}

/** A module within a program, as returned by `GET /programs/:id`. */
export interface ModuleDetail {
  id: string;
  title: string;
  description: string | null;
  order: number;
  unlockMode: ModuleUnlockMode;
  unlockDays: number | null;
  lessons: LessonDetail[];
}

/**
 * Result of `GET /programs/:id` and `PATCH /programs/:id` — the full program
 * with its ordered modules and their ordered lessons, for the builder to load.
 */
export interface ProgramDetail {
  id: string;
  title: string;
  description: string | null;
  shape: ProgramShape;
  visibility: ProgramVisibility;
  status: ProgramStatus;
  coverStyle: ProgramCoverStyle;
  /** ISO 8601, or null while still a draft that has never been published. */
  publishedAt: string | null;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  /**
   * `true` when the program is `published` AND has been edited since it last
   * went live (`updatedAt > publishedAt`). `false` while a draft or never
   * published. Authoritative source for the PublishBar "unpublished changes"
   * badge (feature 0012 slice 3 / ADR-014).
   */
  hasUnpublishedChanges: boolean;
  modules: ModuleDetail[];
}
