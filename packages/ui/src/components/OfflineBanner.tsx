'use client';

import type { CSSProperties } from 'react';
import { Button } from './Button';

export interface OfflineBannerProps {
  /**
   * The reassuring, non-destructive message. Default speaks to a transient
   * connection drop (plan B.3 — silent-refresh failure surface).
   */
  message?: string;
  /** Phosphor icon class suffix. Default 'ph-wifi-slash'. */
  icon?: string;
  /**
   * Tone: 'warn' (amber, default — a recoverable interruption) or 'neutral'
   * (quiet, informational).
   */
  tone?: 'warn' | 'neutral';
  /** Retry action label. When set together with `onRetry`, renders a retry button. */
  retryLabel?: string;
  onRetry?: () => void;
  /** Retry is in flight — shows the spinner and blocks a second press. */
  retrying?: boolean;
  style?: CSSProperties;
}

/**
 * Inline, non-destructive connectivity banner (plan B.3 / D3). Auth's silent
 * refresh is its first consumer: a transient network failure surfaces this
 * (session preserved) rather than ejecting the user. Announced politely to
 * assistive tech via `role="status"` + `aria-live="polite"` — it's an ambient
 * status change, never an interruption.
 */
export function OfflineBanner({
  message = "You're offline. We'll keep trying to reconnect.",
  icon = 'ph-wifi-slash',
  tone = 'warn',
  retryLabel,
  onRetry,
  retrying = false,
  style,
}: OfflineBannerProps) {
  const bg = tone === 'warn' ? 'var(--color-status-warn-bg)' : 'var(--color-status-neutral-bg)';
  const fg = tone === 'warn' ? 'var(--color-status-warn-text)' : 'var(--color-status-neutral-text)';
  const showRetry = !!retryLabel && !!onRetry;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: bg,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${fg} 22%, transparent)`,
        fontFamily: 'var(--font-body)',
        ...style,
      }}
    >
      <i className={'ph ' + icon} aria-hidden style={{ fontSize: 18, color: fg, flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.45,
          color: fg,
        }}
      >
        {message}
      </span>
      {showRetry && (
        <Button
          variant="ghost"
          size="sm"
          loading={retrying}
          onClick={onRetry}
          style={{ flexShrink: 0, color: fg }}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
