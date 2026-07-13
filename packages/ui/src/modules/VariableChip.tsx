import type { CSSProperties } from 'react';

export interface VariableChipProps {
  name: string;
  value: string;
  style?: CSSProperties;
}

/**
 * A locked template-variable pill (ADR-005) — visually distinct from editable
 * text so a reviewer can see what's dynamic vs. what they're editing.
 */
export function VariableChip({ name, value, style }: VariableChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-accent-teal-soft)',
        color: 'var(--color-accent-teal)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 600,
        ...style,
      }}
    >
      <i className="ph ph-lock-simple" style={{ fontSize: 11 }} />
      {name}: {value}
    </span>
  );
}
