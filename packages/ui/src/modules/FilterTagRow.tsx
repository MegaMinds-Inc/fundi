'use client';

import type { CSSProperties } from 'react';
import { Tag } from '../components/Tag';
import type { TagProps } from '../components/Tag';

export interface FilterTagOption {
  /** `null` is the "All" option. */
  value: string | null;
  label: string;
  color?: TagProps['color'];
}

export interface FilterTagRowProps {
  options: FilterTagOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  style?: CSSProperties;
}

/**
 * Horizontally-scrollable single-select `Tag` row with a right-edge fade
 * (mask) + scroll-snap + hidden scrollbar (`fundi-scroll-x`) — the "more
 * content scrolls right" affordance from the handoff.
 */
export function FilterTagRow({ options, value, onChange, style }: FilterTagRowProps) {
  return (
    <div
      className="fundi-scroll-x"
      style={{
        display: 'flex',
        gap: 8,
        paddingBottom: 2,
        scrollSnapType: 'x proximity',
        WebkitMaskImage: 'linear-gradient(to right, #000 88%, transparent)',
        maskImage: 'linear-gradient(to right, #000 88%, transparent)',
        ...style,
      }}
    >
      {options.map((o) => (
        <div key={o.value ?? '__all__'} style={{ scrollSnapAlign: 'start', flex: 'none' }}>
          <Tag
            color={o.color ?? 'neutral'}
            selected={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Tag>
        </div>
      ))}
    </div>
  );
}
