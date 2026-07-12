'use client';

import type { ReactNode } from 'react';

/**
 * Bottom drawer / action sheet — mobile-first alternative to the centered
 * Modal for "act on this item" flows. Slides up from the bottom, covers
 * most of the screen (not a small popover), scrim behind, independently
 * scrolling body, sticky footer for actions.
 *
 * Positioned `absolute` within the nearest positioned ancestor (per the design
 * handoff); wrap in a full-viewport `position: relative` container for a
 * page-level sheet.
 */
export interface DrawerProps {
  open: boolean;
  /** Drawer header title, e.g. a learner or item name */
  title?: string;
  /** Small mono-font line under the title, e.g. a cohort or context label */
  subtitle?: string;
  /** Optional slot under the header for a badge/tag row (e.g. a status badge) */
  signalSlot?: ReactNode;
  onClose?: () => void;
  /** Scrollable body content */
  children?: ReactNode;
  /** Sticky footer — stack a full-width primary action over secondary actions to avoid button-row wrapping on narrow screens */
  footer?: ReactNode;
  /** How much of the container height the drawer covers when open. Default '88%' */
  heightPercent?: string;
}

export function Drawer({
  open,
  title,
  subtitle,
  signalSlot,
  onClose,
  children,
  footer,
  heightPercent = '88%',
}: DrawerProps) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-overlay-scrim)',
          zIndex: 20,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 21,
          height: heightPercent,
          background: 'var(--color-bg-surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: 'var(--shadow-popover)',
          border: '1px solid var(--color-border-subtle)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 260ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flex: 'none' }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: 'var(--color-border-strong)',
            }}
          />
        </div>

        {(title || subtitle || signalSlot) && (
          <div
            style={{
              padding: '6px 20px 14px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flex: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                {title && (
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 17,
                      color: 'var(--color-text-heading)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {title}
                  </div>
                )}
                {subtitle && (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10.5,
                      color: 'var(--color-text-faint)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
              <div
                onClick={onClose}
                style={{
                  flex: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </div>
            </div>
            {signalSlot && <div style={{ marginTop: 10 }}>{signalSlot}</div>}
          </div>
        )}

        <div
          style={{
            padding: 20,
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: '12px 20px 20px',
              borderTop: '1px solid var(--color-border-subtle)',
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
