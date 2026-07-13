import type { CSSProperties } from 'react';
import type { EnrollmentState } from '@fundi/types';
import { Badge } from '../components/Badge';
import { getEnrollmentMeta } from '../enrollment-meta';

export interface EnrollmentBadgeProps {
  state: EnrollmentState;
  /** Icon only, label hidden. */
  compact?: boolean;
  style?: CSSProperties;
}

/** Status pill for an enrollment's lifecycle state (`ENROLLMENT_META`). */
export function EnrollmentBadge({ state, compact = false, style }: EnrollmentBadgeProps) {
  const meta = getEnrollmentMeta(state);
  return (
    <Badge
      tone={meta.tone}
      style={{ gap: compact ? 0 : 5, fontSize: compact ? 10.5 : 12, ...style }}
    >
      <i className={`ph ${meta.icon}`} style={{ fontSize: compact ? 12 : 13 }} />
      {!compact && meta.label}
    </Badge>
  );
}
