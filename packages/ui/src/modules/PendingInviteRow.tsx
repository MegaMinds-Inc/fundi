import type { CSSProperties } from 'react';
import { AvatarInitial } from '../components/AvatarInitial';
import { Button } from '../components/Button';
import { RelativeTime } from '../components/RelativeTime';

export interface PendingInviteRowProps {
  name: string;
  phone: string;
  hoursAgo: number;
  onApprove: () => void;
  onDecline: () => void;
  style?: CSSProperties;
}

/** One pending-approval row in `InviteApprove`. */
export function PendingInviteRow({
  name,
  phone,
  hoursAgo,
  onApprove,
  onDecline,
  style,
}: PendingInviteRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', ...style }}>
      <AvatarInitial name={name} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--color-text-heading)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-text-faint)',
            }}
          >
            {phone}
          </span>
          <span style={{ color: 'var(--color-text-faint)' }}>·</span>
          <RelativeTime hoursAgo={hoursAgo} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
        <Button variant="ghost" size="sm" onClick={onDecline}>
          Decline
        </Button>
        <Button size="sm" onClick={onApprove}>
          Approve
        </Button>
      </div>
    </div>
  );
}
