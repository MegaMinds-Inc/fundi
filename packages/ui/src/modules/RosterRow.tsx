import type { CSSProperties } from 'react';
import type { EnrollmentState } from '@fundi/types';
import { AvatarInitial } from '../components/AvatarInitial';
import { ProgressBar } from '../components/ProgressBar';
import { EnrollmentBadge } from './EnrollmentBadge';

export interface RosterRowProps {
  name: string;
  progressPercent: number;
  state: EnrollmentState;
  /** Dense table-row layout instead of the stacked card cell. */
  dense?: boolean;
  style?: CSSProperties;
}

/** Column template for the dense layout — exported so a table header can match it. */
export const ROSTER_ROW_COLUMNS = '1.6fr 1.4fr auto';

const nameStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  color: 'var(--color-text-heading)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const pctStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--color-text-faint)',
  flex: 'none',
};

/** One learner in a `CohortRoster` — card cell (mobile) or table row (`dense`). */
export function RosterRow({ name, progressPercent, state, dense = false, style }: RosterRowProps) {
  if (dense) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: ROSTER_ROW_COLUMNS,
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontFamily: 'var(--font-body)',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <AvatarInitial name={name} size={28} />
          <span style={{ ...nameStyle, fontSize: 13 }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar percent={progressPercent} style={{ flex: 1 }} />
          <span style={pctStyle}>{Math.round(progressPercent)}%</span>
        </div>
        <EnrollmentBadge state={state} compact />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', ...style }}>
      <AvatarInitial name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span style={{ ...nameStyle, fontSize: 14 }}>{name}</span>
          <EnrollmentBadge state={state} compact />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProgressBar percent={progressPercent} style={{ flex: 1 }} />
          <span style={pctStyle}>{Math.round(progressPercent)}%</span>
        </div>
      </div>
    </div>
  );
}
