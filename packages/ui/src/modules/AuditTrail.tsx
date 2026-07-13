import type { CSSProperties } from 'react';
import { EmptyState } from '../components/EmptyState';
import { AuditRow, type AuditAction } from './AuditRow';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  recipient: string;
  text: string;
  when: string;
}

export interface AuditTrailProps {
  entries: AuditEntry[];
  style?: CSSProperties;
}

/** Read-only history of sent/rejected drafts — the ADR-011 compliance record. */
export function AuditTrail({ entries, style }: AuditTrailProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="ph-clock-counter-clockwise"
        title="No history yet"
        body="Messages you approve or reject will be recorded here."
        tone="neutral"
      />
    );
  }
  return (
    <div style={{ ...style }}>
      {entries.map((e) => (
        <AuditRow
          key={e.id}
          action={e.action}
          recipient={e.recipient}
          text={e.text}
          when={e.when}
        />
      ))}
    </div>
  );
}
