'use client';

import { useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';

export interface TagProps {
  children: ReactNode;
  selected?: boolean;
  /** Curated hue for the outline/dot and the selected fill — not a free color picker */
  color?: 'neutral' | 'green' | 'teal' | 'amber' | 'red';
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  style?: CSSProperties;
}

const TAG_COLORS: Record<
  NonNullable<TagProps['color']>,
  { text: string; border: string; bg: string }
> = {
  neutral: {
    text: 'var(--color-text-muted)',
    border: 'var(--color-border-strong)',
    bg: 'var(--color-accent-primary)',
  },
  green: {
    text: 'var(--base-green-500)',
    border: 'var(--base-green-500)',
    bg: 'var(--base-green-500)',
  },
  teal: {
    text: 'var(--base-teal-500)',
    border: 'var(--base-teal-500)',
    bg: 'var(--base-teal-500)',
  },
  amber: {
    text: 'var(--base-amber-500)',
    border: 'var(--base-amber-500)',
    bg: 'var(--base-amber-500)',
  },
  red: { text: 'var(--base-red-500)', border: 'var(--base-red-500)', bg: 'var(--base-red-500)' },
};

export function Tag({
  children,
  selected = false,
  color = 'neutral',
  onClick,
  removable = false,
  onRemove,
  style,
}: TagProps) {
  const [hover, setHover] = useState(false);
  const c = TAG_COLORS[color] ?? TAG_COLORS.neutral;
  const showDot = color !== 'neutral' && !selected;

  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 10.5,
        letterSpacing: '.02em',
        padding: '5px 11px',
        borderRadius: 'var(--radius-pill)',
        cursor: onClick ? 'pointer' : 'default',
        background: selected
          ? c.bg
          : hover && onClick
            ? 'color-mix(in srgb, ' + c.border + ' 10%, transparent)'
            : 'transparent',
        color: selected ? 'var(--color-text-on-accent)' : c.text,
        boxShadow: selected ? 'none' : `inset 0 0 0 1px ${c.border}`,
        transition: 'background 150ms ease, color 150ms ease',
        ...style,
      }}
    >
      {showDot && (
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', background: c.border, flex: 'none' }}
        />
      )}
      {children}
      {removable && (
        <span
          onClick={(e: MouseEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            onRemove?.();
          }}
          style={{ opacity: 0.7, fontWeight: 800, fontSize: 11 }}
        >
          ×
        </span>
      )}
    </span>
  );
}
