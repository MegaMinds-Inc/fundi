'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  style?: CSSProperties;
}

/**
 * Centered modal. Positioned `absolute` within the nearest positioned ancestor
 * (per the design handoff — screens render it inside a positioned app shell);
 * wrap in a `position: relative` / full-viewport container for a page-level dialog.
 */
export function Modal({ open, title, children, footer, onClose, style }: ModalProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--color-overlay-scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
        style={{
          width: 360,
          maxWidth: '90%',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-popover)',
          fontFamily: 'var(--font-body)',
          overflow: 'hidden',
          ...style,
        }}
      >
        {title && (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text-heading)',
              }}
            >
              {title}
            </span>
            <span
              onClick={onClose}
              style={{ cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16 }}
            >
              ×
            </span>
          </div>
        )}
        <div style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
