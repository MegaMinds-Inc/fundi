import type { SignalType } from '@fundi/types';
import type { BadgeProps } from './components/Badge';

/**
 * UI-layer metadata for each ADR-010 Signal type: the human label, a Phosphor
 * icon suffix, and the `Badge` tone it maps to. Co-located in `packages/ui`
 * (not `@fundi/types`) because `tone` must stay a subtype of `Badge`'s own tone
 * union, which is defined here — see the design-system task backlog
 * (`packages/docs/design-system/tasks/shared-utilities.md`).
 */
export interface SignalMeta {
  label: string;
  /** Phosphor icon class suffix, e.g. 'ph-calendar-x'. */
  icon: string;
  tone: NonNullable<BadgeProps['tone']>;
}

/**
 * Keyed by `SignalType` via `Record`, so adding a 6th `SignalType` in
 * `@fundi/types` without a matching entry here is a **compile error**, not a
 * silent runtime gap (mirrors the `TENANT_SCOPED_MODELS` drift guard on the API).
 */
export const SIGNAL_META: Record<SignalType, SignalMeta> = {
  lesson_overdue: { label: 'Lesson overdue', icon: 'ph-calendar-x', tone: 'warn' },
  reminder_unacknowledged: {
    label: 'Reminder unacknowledged',
    icon: 'ph-bell-simple-slash',
    tone: 'warn',
  },
  quiz_failed: { label: 'Quiz failed', icon: 'ph-x-circle', tone: 'danger' },
  help_requested: { label: 'Asked for help', icon: 'ph-hand-waving', tone: 'draft' },
  went_quiet: { label: 'Went quiet', icon: 'ph-moon-stars', tone: 'neutral' },
};

/** Fallback for an unrecognized key — a neutral, non-alarming default. */
export const FALLBACK_SIGNAL_META: SignalMeta = {
  label: 'Signal',
  icon: 'ph-info',
  tone: 'neutral',
};

/**
 * Resolve a Signal's display metadata, degrading gracefully: an unrecognized
 * key returns {@link FALLBACK_SIGNAL_META} rather than throwing, so every
 * consumer (SignalBadge, ExceptionCard, FilterSortBar) gets the safe default
 * for free instead of re-implementing it.
 */
export function getSignalMeta(signal: SignalType | string): SignalMeta {
  return SIGNAL_META[signal as SignalType] ?? FALLBACK_SIGNAL_META;
}
