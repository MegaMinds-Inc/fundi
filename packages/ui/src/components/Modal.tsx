'use client';

import { useId } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useDialogA11y } from '../lib/useDialogA11y';

export interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  style?: CSSProperties;
}

const CLOSE_BUTTON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  padding: 4,
  margin: -4,
  cursor: 'pointer',
  color: 'var(--color-text-muted)',
  fontSize: 16,
  lineHeight: 1,
  borderRadius: 'var(--radius-sm)',
};

/**
 * Centered modal dialog. Positioned `absolute` within the nearest positioned
 * ancestor (per the design handoff — screens render it inside a positioned app
 * shell); wrap in a `position: relative` / full-viewport container for a
 * page-level dialog. Focus is trapped while open, Escape closes it, and focus
 * returns to the trigger on close (see useDialogA11y).
 */
export function Modal({ open, title, children, footer, onClose, style }: ModalProps) {
  const dialogRef = useDialogA11y(open, onClose);
  const titleId = useId();
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
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
          outline: 'none',
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
              id={titleId}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--color-text-heading)',
              }}
            >
              {title}
            </span>
            <button type="button" aria-label="Close" onClick={onClose} style={CLOSE_BUTTON_STYLE}>
              ×
            </button>
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
