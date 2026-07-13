'use client';

import type { CSSProperties } from 'react';
import type { SignalType } from '@fundi/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { RelativeTime } from '../components/RelativeTime';
import { SignalBadge } from './SignalBadge';

export interface ExceptionCardProps {
  learner: string;
  cohort: string;
  signal: SignalType;
  hoursAgo: number;
  /** Optional AI-suggested next action. */
  suggestion?: string;
  onAct: () => void;
  onOpen: () => void;
  onSnooze: () => void;
  style?: CSSProperties;
}

const nameStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 15,
  color: 'var(--color-text-heading)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * The mobile/tablet queue unit — a learner surfaced because a Signal fired.
 * The whole card opens the item (`onOpen`); the action buttons stop propagation
 * so they don't also trigger it (a behavior the handoff was explicit about).
 * The desktop table rendering is a separate module — `ExceptionTableRow`.
 */
export function ExceptionCard({
  learner,
  cohort,
  signal,
  hoursAgo,
  suggestion,
  onAct,
  onOpen,
  onSnooze,
  style,
}: ExceptionCardProps) {
  return (
    <Card interactive onClick={onOpen} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={nameStyle}>{learner}</div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text-faint)',
                marginTop: 2,
              }}
            >
              {cohort}
            </div>
          </div>
          <SignalBadge signal={signal} />
        </div>
        {suggestion && (
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
            }}
          >
            <i
              className="ph ph-sparkle"
              style={{ marginRight: 6, color: 'var(--color-accent-teal)' }}
            />
            {suggestion}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <RelativeTime hoursAgo={hoursAgo} />
          {/* Actions stop the click from bubbling up to the card's onOpen. */}
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={onSnooze}>
              Snooze
            </Button>
            <Button size="sm" onClick={onAct}>
              Take action
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
