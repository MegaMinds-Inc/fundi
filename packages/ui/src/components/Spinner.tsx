import type { CSSProperties } from 'react';

export interface SpinnerProps {
  /** Diameter in px. Default 20. */
  size?: number;
  /** Color of the moving arc; defaults to the accent. */
  color?: string;
  style?: CSSProperties;
}

/**
 * Minimal CSS ring spinner (uses the `fundi-spin` keyframes in
 * `tokens/animation.css`). Presentational — no client hooks.
 */
export function Spinner({ size = 20, color = 'var(--color-accent-primary)', style }: SpinnerProps) {
  const border = Math.max(2, Math.round(size / 10));
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${border}px solid var(--color-border-strong)`,
        borderTopColor: color,
        animation: 'fundi-spin 0.7s linear infinite',
        ...style,
      }}
    />
  );
}
