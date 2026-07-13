'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

export interface FabProps {
  /** Phosphor icon class suffix, e.g. 'ph-hand-waving'. */
  icon: string;
  onClick?: () => void;
  /** Required — the FAB is icon-only. */
  ariaLabel: string;
  tone?: 'primary' | 'teal';
  /** Offsets in px from the bottom-right. Default 20/20. */
  offset?: { bottom?: number; right?: number };
  style?: CSSProperties;
}

/** Fixed circular floating action button. Backs `HelpButton`. */
export function Fab({ icon, onClick, ariaLabel, tone = 'teal', offset, style }: FabProps) {
  const [hover, setHover] = useState(false);
  const accent = tone === 'teal' ? 'var(--color-accent-teal)' : 'var(--color-accent-primary)';
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'fixed',
        bottom: offset?.bottom ?? 20,
        right: offset?.right ?? 20,
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        background: accent,
        color: 'var(--color-text-on-accent)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        boxShadow: hover
          ? `0 10px 24px -6px color-mix(in srgb, ${accent} 45%, transparent)`
          : `0 6px 16px -6px color-mix(in srgb, ${accent} 35%, transparent)`,
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 160ms ease, box-shadow 220ms ease',
        zIndex: 30,
        ...style,
      }}
    >
      <i className={'ph ' + icon} />
    </button>
  );
}
