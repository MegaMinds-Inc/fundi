'use client';

import type { CSSProperties } from 'react';
import { Tag } from '../components/Tag';

export interface SortToggleProps {
  sort: 'newest' | 'oldest';
  onSort: (sort: 'newest' | 'oldest') => void;
  style?: CSSProperties;
}

/** "Most stale / Newest" two-option sort toggle for the triage queue. */
export function SortToggle({ sort, onSort, style }: SortToggleProps) {
  return (
    <div style={{ display: 'inline-flex', gap: 6, flex: 'none', ...style }}>
      <Tag color="green" selected={sort === 'oldest'} onClick={() => onSort('oldest')}>
        Most stale
      </Tag>
      <Tag color="green" selected={sort === 'newest'} onClick={() => onSort('newest')}>
        Newest
      </Tag>
    </div>
  );
}
