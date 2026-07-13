import type { CSSProperties } from 'react';

export type AuditAction = 'sent' | 'sent_unedited' | 'rejected';

export interface AuditRowProps {
  action: AuditAction;
  recipient: string;
  text: string;
  /** Preformatted timestamp, e.g. "2h ago". */
  when: string;
  style?: CSSProperties;
}

const ACTION_META: Record<AuditAction, { icon: string; color: string }> = {
  sent: { icon: 'ph-check-circle', color: 'var(--color-status-live-text)' },
  sent_unedited: { icon: 'ph-check-circle', color: 'var(--color-accent-teal)' },
  rejected: { icon: 'ph-x-circle', color: 'var(--color-status-danger-text)' },
};

/** One read-only history entry. Rejected entries render their text italic. */
export function AuditRow({ action, recipient, text, when, style }: AuditRowProps) {
  const meta = ACTION_META[action];
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 4px',
        borderBottom: '1px solid var(--color-border-subtle)',
        ...style,
      }}
    >
      <i
        className={`ph ${meta.icon}`}
        style={{ fontSize: 18, color: meta.color, flex: 'none', marginTop: 1 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'baseline',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
              color: 'var(--color-text-heading)',
            }}
          >
            {recipient}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--color-text-faint)',
              flex: 'none',
            }}
          >
            {when}
          </span>
        </div>
        <p
          style={{
            margin: '3px 0 0',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--color-text-muted)',
            fontStyle: action === 'rejected' ? 'italic' : 'normal',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
