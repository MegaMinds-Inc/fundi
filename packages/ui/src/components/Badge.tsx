import type { CSSProperties, ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  tone?: 'live' | 'draft' | 'warn' | 'danger' | 'neutral';
  style?: CSSProperties;
}

const TONE: Record<NonNullable<BadgeProps['tone']>, { bg: string; text: string }> = {
  live: { bg: 'var(--color-status-live-bg)', text: 'var(--color-status-live-text)' },
  draft: { bg: 'var(--color-status-draft-bg)', text: 'var(--color-status-draft-text)' },
  warn: { bg: 'var(--color-status-warn-bg)', text: 'var(--color-status-warn-text)' },
  danger: { bg: 'var(--color-status-danger-bg)', text: 'var(--color-status-danger-text)' },
  neutral: { bg: 'var(--color-status-neutral-bg)', text: 'var(--color-status-neutral-text)' },
};

export function Badge({ children, tone = 'neutral', style }: BadgeProps) {
  const t = TONE[tone] ?? TONE.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 12,
        padding: '6px 13px',
        borderRadius: 'var(--radius-pill)',
        background: t.bg,
        color: t.text,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
