import type { CSSProperties } from 'react';
import type { SignalType } from '@fundi/types';
import { Badge } from '../components/Badge';
import { getSignalMeta } from '../signal-meta';

export interface SignalBadgeProps {
  signal: SignalType;
  /** Tighter sizing for dense rows. */
  compact?: boolean;
  style?: CSSProperties;
}

/**
 * The single visual definition of a Signal: a `Badge` toned + iconed + labelled
 * from `SIGNAL_META`. Unrecognized keys fall back via `getSignalMeta`.
 */
export function SignalBadge({ signal, compact = false, style }: SignalBadgeProps) {
  const meta = getSignalMeta(signal);
  return (
    <Badge tone={meta.tone} style={{ gap: 5, fontSize: compact ? 10.5 : 12, ...style }}>
      <i className={`ph ${meta.icon}`} style={{ fontSize: compact ? 12 : 13 }} />
      {meta.label}
    </Badge>
  );
}
