import type { EnrollmentState } from '@fundi/types';
import type { BadgeProps } from './components/Badge';

/**
 * UI-layer metadata per enrollment lifecycle state — label, Phosphor icon, and
 * `Badge` tone. Same pattern as `signal-meta.ts`; co-located in `packages/ui`
 * because `tone` must stay a subtype of `Badge`'s tone union.
 */
export interface EnrollmentMeta {
  label: string;
  icon: string;
  tone: NonNullable<BadgeProps['tone']>;
}

/** `Record` keying makes a missing/added `EnrollmentState` a compile error. */
export const ENROLLMENT_META: Record<EnrollmentState, EnrollmentMeta> = {
  pending_approval: { label: 'Pending', icon: 'ph-hourglass-medium', tone: 'warn' },
  active: { label: 'Active', icon: 'ph-check-circle', tone: 'live' },
  completed: { label: 'Completed', icon: 'ph-flag-checkered', tone: 'draft' },
  dropped: { label: 'Dropped', icon: 'ph-prohibit', tone: 'neutral' },
};

/** Unknown states fall back to `active` styling (per the handoff). */
export const FALLBACK_ENROLLMENT_META: EnrollmentMeta = ENROLLMENT_META.active;

export function getEnrollmentMeta(state: EnrollmentState | string): EnrollmentMeta {
  return ENROLLMENT_META[state as EnrollmentState] ?? FALLBACK_ENROLLMENT_META;
}
