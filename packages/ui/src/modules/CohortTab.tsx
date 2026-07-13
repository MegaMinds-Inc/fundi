import type { CSSProperties } from 'react';

export interface CohortTabProps {
  name: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  style?: CSSProperties;
}

/** A cohort selector pill showing name + learner count. */
export function CohortTab({ name, count, active, onSelect, style }: CohortTabProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flex: 'none',
        padding: '8px 14px',
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 12.5,
        background: active ? 'var(--color-accent-primary)' : 'var(--color-bg-elevated)',
        color: active ? 'var(--color-text-on-accent)' : 'var(--color-text-muted)',
        transition: 'background 150ms ease, color 150ms ease',
        ...style,
      }}
    >
      {name}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>{count}</span>
    </button>
  );
}
