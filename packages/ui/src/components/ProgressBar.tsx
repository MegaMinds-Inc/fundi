import type { CSSProperties } from 'react';

export interface ProgressBarProps {
  /** 0–100. Clamped to that range. */
  percent: number;
  tone?: 'primary' | 'teal';
  /** Track height in px. Default 8. */
  height?: number;
  style?: CSSProperties;
}

/** Pill-shaped progress bar. Presentational. */
export function ProgressBar({ percent, tone = 'primary', height = 8, style }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const fill = tone === 'teal' ? 'var(--color-accent-teal)' : 'var(--color-accent-primary)';
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-bg-elevated)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: 'var(--radius-pill)',
          background: fill,
          transition: 'width 320ms cubic-bezier(.4,0,.2,1)',
        }}
      />
    </div>
  );
}
