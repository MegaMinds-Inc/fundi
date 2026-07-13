'use client';

import type { EnrollmentState } from '@fundi/types';
import { EmptyState } from '../components/EmptyState';
import { useBreakpoint } from '../lib/use-breakpoint';
import { CohortTab } from './CohortTab';
import { RosterRow } from './RosterRow';
import styles from './CohortRoster.module.css';

export interface CohortRosterLearner {
  name: string;
  progressPercent: number;
  state: EnrollmentState;
}

export interface Cohort {
  id: string;
  name: string;
  schedule?: string;
  roster: CohortRosterLearner[];
}

export interface CohortRosterProps {
  cohorts: Cohort[];
  activeId: string;
  onSelect: (cohortId: string) => void;
  /**
   * `'auto'` (default) renders the dense table at the desktop breakpoint and the
   * card list below it (via `useBreakpoint`). Force a layout with `'cards'` /
   * `'table'` — e.g. in a story, or when the screen already knows its context.
   */
  layout?: 'auto' | 'cards' | 'table';
}

/** Cohort switcher + learner roster. Card list (mobile/tablet) ↔ table (desktop). */
export function CohortRoster({ cohorts, activeId, onSelect, layout = 'auto' }: CohortRosterProps) {
  const breakpoint = useBreakpoint();
  const showTable = layout === 'table' || (layout === 'auto' && breakpoint === 'desktop');

  const active = cohorts.find((c) => c.id === activeId) ?? cohorts[0];
  const roster = active?.roster ?? [];

  return (
    <div className={styles.root}>
      {cohorts.length > 0 && (
        <div className={styles.tabRow}>
          {cohorts.map((c) => (
            <CohortTab
              key={c.id}
              name={c.name}
              count={c.roster.length}
              active={c.id === active?.id}
              onSelect={() => onSelect(c.id)}
            />
          ))}
        </div>
      )}

      {roster.length === 0 ? (
        <EmptyState
          icon="ph-users-three"
          title={cohorts.length === 0 ? 'No cohorts yet' : 'No learners yet'}
          body={
            cohorts.length === 0
              ? 'Create a cohort to start enrolling learners.'
              : 'Enrolled learners will appear here.'
          }
          tone="neutral"
        />
      ) : showTable ? (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.headCell}>Learner</span>
            <span className={styles.headCell}>Progress</span>
            <span className={styles.headCell}>Status</span>
          </div>
          {roster.map((l, i) => (
            <RosterRow
              key={`${l.name}-${i}`}
              name={l.name}
              progressPercent={l.progressPercent}
              state={l.state}
              dense
            />
          ))}
        </div>
      ) : (
        <div>
          {roster.map((l, i) => (
            <RosterRow
              key={`${l.name}-${i}`}
              name={l.name}
              progressPercent={l.progressPercent}
              state={l.state}
            />
          ))}
        </div>
      )}
    </div>
  );
}
