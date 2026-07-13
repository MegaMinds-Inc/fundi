'use client';

import type { CSSProperties } from 'react';
import { SignalType } from '@fundi/types';
import type { TagProps } from '../components/Tag';
import { getSignalMeta, type SignalMeta } from '../signal-meta';
import { FilterTagRow, type FilterTagOption } from './FilterTagRow';
import { SortToggle } from './SortToggle';

const TONE_TO_TAG: Record<SignalMeta['tone'], NonNullable<TagProps['color']>> = {
  live: 'green',
  draft: 'teal',
  warn: 'amber',
  danger: 'red',
  neutral: 'neutral',
};

// "All" + one option per Signal type, tone-mapped to a Tag color.
const FILTER_OPTIONS: FilterTagOption[] = [
  { value: null, label: 'All', color: 'neutral' },
  ...Object.values(SignalType).map((s) => {
    const meta = getSignalMeta(s);
    return { value: s, label: meta.label, color: TONE_TO_TAG[meta.tone] };
  }),
];

export interface FilterSortBarProps {
  signalFilter: SignalType | null;
  onSignalFilter: (signal: SignalType | null) => void;
  sort: 'newest' | 'oldest';
  onSort: (sort: 'newest' | 'oldest') => void;
  resultCount: number;
  style?: CSSProperties;
}

/** Persistent filter/sort control for the "Needs You" queue. */
export function FilterSortBar({
  signalFilter,
  onSignalFilter,
  sort,
  onSort,
  resultCount,
  style,
}: FilterSortBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'var(--font-body)',
        ...style,
      }}
    >
      <FilterTagRow
        options={FILTER_OPTIONS}
        value={signalFilter}
        onChange={(v) => onSignalFilter(v as SignalType | null)}
      />
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          {resultCount} {resultCount === 1 ? 'learner needs' : 'learners need'} you
        </span>
        <SortToggle sort={sort} onSort={onSort} />
      </div>
    </div>
  );
}
