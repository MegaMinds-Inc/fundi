'use client';

import type { CSSProperties } from 'react';
import type { SignalType } from '@fundi/types';
import { Button } from '../components/Button';
import { RelativeTime } from '../components/RelativeTime';
import { SignalBadge } from './SignalBadge';

export interface ExceptionTableRowProps {
  learner: string;
  cohort: string;
  signal: SignalType;
  hoursAgo: number;
  onAct: () => void;
  onOpen: () => void;
  onSnooze: () => void;
  style?: CSSProperties;
}

/**
 * The **desktop** rendering of a queue item — a dense grid row, a distinct
 * layout from `ExceptionCard` (not the card shrunk), per the handoff. Columns:
 * learner / cohort / signal / stale / actions. The grid template is exported so
 * the screen can render a matching header row.
 */
export const EXCEPTION_ROW_COLUMNS = '1.4fr 1fr 1.2fr 0.8fr auto';

const cell: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function ExceptionTableRow({
  learner,
  cohort,
  signal,
  hoursAgo,
  onAct,
  onOpen,
  onSnooze,
  style,
}: ExceptionTableRowProps) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: EXCEPTION_ROW_COLUMNS,
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--color-border-subtle)',
        fontFamily: 'var(--font-body)',
        ...style,
      }}
    >
      <span
        style={{
          ...cell,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13.5,
          color: 'var(--color-text-heading)',
        }}
      >
        {learner}
      </span>
      <span
        style={{
          ...cell,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--color-text-faint)',
        }}
      >
        {cohort}
      </span>
      <span style={cell}>
        <SignalBadge signal={signal} compact />
      </span>
      <RelativeTime hoursAgo={hoursAgo} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
      >
        <Button variant="ghost" size="sm" onClick={onSnooze}>
          Snooze
        </Button>
        <Button size="sm" onClick={onAct}>
          Take action
        </Button>
      </div>
    </div>
  );
}
