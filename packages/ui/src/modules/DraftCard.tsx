'use client';

import type { CSSProperties } from 'react';
import { Badge } from '../components/Badge';
import type { BadgeProps } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { RelativeTime } from '../components/RelativeTime';

export interface DraftCardProps {
  /** Draft kind, e.g. 'reminder' | 'check-in' | 'broadcast'. */
  kind: string;
  recipient: string;
  minutesAgo: number;
  text: string;
  onReview: () => void;
  style?: CSSProperties;
}

const KIND_TONE: Record<string, NonNullable<BadgeProps['tone']>> = {
  reminder: 'live',
  'check-in': 'draft',
  broadcast: 'warn',
};

/** One pending AI draft in `DraftQueue`. Card and button both open the review. */
export function DraftCard({ kind, recipient, minutesAgo, text, onReview, style }: DraftCardProps) {
  return (
    <Card interactive onClick={onReview} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Badge tone={KIND_TONE[kind] ?? 'neutral'}>{kind}</Badge>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 13.5,
                color: 'var(--color-text-heading)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {recipient}
            </span>
          </div>
          <RelativeTime minutesAgo={minutesAgo} />
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--color-text-muted)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {text}
        </p>
        {/* Button click shouldn't also bubble to the card's onReview. */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <Button variant="secondary" size="sm" onClick={onReview}>
            Review draft
          </Button>
        </div>
      </div>
    </Card>
  );
}
