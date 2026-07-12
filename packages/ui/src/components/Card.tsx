'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface CardProps {
  title?: string;
  /** Right-aligned header metadata, e.g. "6 modules" */
  meta?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional full-bleed 16:9 media slot above the header (image, video thumb, or placeholder) */
  media?: ReactNode;
  /** Adds hover lift + deeper shadow; implied by passing onClick */
  interactive?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Card({
  title,
  meta,
  children,
  footer,
  media,
  interactive = false,
  onClick,
  style,
}: CardProps) {
  const [hover, setHover] = useState(false);
  const clickable = interactive || !!onClick;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => clickable && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-bg-surface)',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: clickable && hover ? 'var(--shadow-popover)' : 'var(--shadow-card)',
        transform: clickable && hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 220ms cubic-bezier(.4,0,.2,1), box-shadow 220ms ease',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 1,
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-text-heading) 14%, transparent), transparent)',
          zIndex: 1,
        }}
      />
      {media && (
        <div style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden' }}>{media}</div>
      )}
      {(title || meta) && (
        <div
          style={{
            padding: '15px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {title && (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '-0.01em',
                color: 'var(--color-text-heading)',
              }}
            >
              {title}
            </span>
          )}
          {meta && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-text-faint)',
              }}
            >
              {meta}
            </span>
          )}
        </div>
      )}
      <div style={{ padding: 18 }}>{children}</div>
      {footer && (
        <div style={{ padding: '13px 18px', borderTop: '1px solid var(--color-border-subtle)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
