'use client';

import { useState } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { PendingInviteRow } from './PendingInviteRow';
import styles from './InviteApprove.module.css';

export interface PendingInvite {
  id: string;
  name: string;
  phone: string;
  hoursAgo: number;
}

export interface InviteApproveProps {
  pending: PendingInvite[];
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
  onInvite: (phone: string) => void;
}

/**
 * Invite-by-phone form + pending-approval queue (private programs). Send is
 * disabled until the phone field is non-empty; submitting clears it. The invite
 * field + button sit side by side on tablet/desktop and stack on phones (see
 * InviteApprove.module.css).
 */
export function InviteApprove({ pending, onApprove, onDecline, onInvite }: InviteApproveProps) {
  const [phone, setPhone] = useState('');
  const canInvite = phone.trim().length > 0;

  function invite() {
    if (!canInvite) return;
    onInvite(phone.trim());
    setPhone('');
  }

  return (
    <div className={styles.root}>
      <div className={styles.inviteRow}>
        <div className={styles.field}>
          <Input
            label="Invite by phone"
            type="tel"
            inputMode="tel"
            placeholder="+233 20 000 0000"
            iconLeft={<i className="ph ph-phone" />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <Button disabled={!canInvite} onClick={invite}>
          Send invite
        </Button>
      </div>
      <div>
        <div className={styles.sectionLabel}>Pending approval</div>
        {pending.length === 0 ? (
          <EmptyState
            icon="ph-user-check"
            title="No one waiting"
            body="Invites you send that need approval will show up here."
            tone="neutral"
          />
        ) : (
          <div>
            {pending.map((p) => (
              <PendingInviteRow
                key={p.id}
                name={p.name}
                phone={p.phone}
                hoursAgo={p.hoursAgo}
                onApprove={() => onApprove(p.id)}
                onDecline={() => onDecline(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
