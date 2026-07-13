import type { CSSProperties } from 'react';
import { initials } from '../lib/initials';

export interface AvatarInitialProps {
  name: string;
  /** Diameter in px. Default 36. */
  size?: number;
  tone?: 'primary' | 'teal' | 'neutral';
  style?: CSSProperties;
}

const TONES: Record<NonNullable<AvatarInitialProps['tone']>, { bg: string; fg: string }> = {
  primary: { bg: 'var(--color-accent-primary-soft)', fg: 'var(--color-accent-primary)' },
  teal: { bg: 'var(--color-accent-teal-soft)', fg: 'var(--color-accent-teal)' },
  neutral: { bg: 'var(--color-bg-elevated)', fg: 'var(--color-text-muted)' },
};

/**
 * Initial-in-a-circle avatar. Decorative (`aria-hidden`) — the name it derives
 * from is expected alongside it as real text.
 */
export function AvatarInitial({ name, size = 36, tone = 'primary', style }: AvatarInitialProps) {
  const t = TONES[tone] ?? TONES.primary;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background: t.bg,
        color: t.fg,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        ...style,
      }}
    >
      {initials(name)}
    </span>
  );
}
