'use client';

import type { CSSProperties } from 'react';
import { EmptyState } from '../components/EmptyState';
import { DraftCard } from './DraftCard';

export interface Draft {
  id: string;
  kind: string;
  recipient: string;
  minutesAgo: number;
  text: string;
  variables: Record<string, string>;
}

export interface DraftQueueProps {
  drafts: Draft[];
  onReview: (draft: Draft) => void;
  style?: CSSProperties;
}

/** List of pending AI drafts awaiting human approval (ADR-011). */
export function DraftQueue({ drafts, onReview, style }: DraftQueueProps) {
  if (drafts.length === 0) {
    return (
      <EmptyState
        icon="ph-sparkle"
        title="No drafts to review"
        body="As Signals come in, Fundi drafts messages here for you to approve before they send."
      />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {drafts.map((d) => (
        <DraftCard
          key={d.id}
          kind={d.kind}
          recipient={d.recipient}
          minutesAgo={d.minutesAgo}
          text={d.text}
          onReview={() => onReview(d)}
        />
      ))}
    </div>
  );
}
