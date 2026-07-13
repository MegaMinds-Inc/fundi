'use client';

import type { CSSProperties } from 'react';

export interface SnoozePickerProps {
  onSnooze: (days: 1 | 3 | 7) => void;
  style?: CSSProperties;
}

const OPTIONS: Array<{ days: 1 | 3 | 7; label: string }> = [
  { days: 1, label: '1 day' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
];

/** 3 days is the confirmed design default (resolved with product, per the handoff). */
const DEFAULT_DAYS = 3;

/** Inline snooze options; "3 days" is visually marked as the default. */
export function SnoozePicker({ onSnooze, style }: SnoozePickerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        background: 'var(--color-bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'inset 0 0 0 1px var(--color-border-subtle)',
        ...style,
      }}
    >
      {OPTIONS.map((o) => {
        const isDefault = o.days === DEFAULT_DAYS;
        return (
          <button
            key={o.days}
            type="button"
            onClick={() => onSnooze(o.days)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--radius-md)',
              background: isDefault ? 'var(--color-accent-primary-soft)' : 'transparent',
              color: 'var(--color-text-heading)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 13,
              textAlign: 'left',
              boxShadow: isDefault ? 'inset 0 0 0 1px var(--color-accent-primary)' : 'none',
            }}
          >
            <span>
              <i
                className="ph ph-clock"
                style={{ marginRight: 8, color: 'var(--color-text-muted)' }}
              />
              Snooze {o.label}
            </span>
            {isDefault && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  color: 'var(--color-accent-primary)',
                }}
              >
                Default
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
