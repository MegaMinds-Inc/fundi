import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import type { SignalType } from '@fundi/types';
import { EXCEPTION_ROW_COLUMNS, ExceptionTableRow } from './ExceptionTableRow';

const meta = {
  title: 'Modules/ExceptionTableRow',
  component: ExceptionTableRow,
  args: {
    learner: 'Ama Mensah',
    cohort: 'COHORT A',
    signal: 'lesson_overdue',
    hoursAgo: 5,
    onAct: () => {},
    onOpen: () => {},
    onSnooze: () => {},
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minWidth: 720,
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof ExceptionTableRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleRow: Story = {};

const rows = [
  { learner: 'Ama Mensah', cohort: 'COHORT A', signal: 'lesson_overdue', hoursAgo: 5 },
  { learner: 'Kofi Owusu', cohort: 'COHORT A', signal: 'quiz_failed', hoursAgo: 22 },
  { learner: 'Yaa Asantewaa', cohort: 'COHORT B', signal: 'went_quiet', hoursAgo: 73 },
] satisfies Array<{ learner: string; cohort: string; signal: SignalType; hoursAgo: number }>;

const headerCell: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--color-text-faint)',
};

/** A few rows under a matching header — the desktop table rendering. */
export const Table: Story = {
  render: () => (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: EXCEPTION_ROW_COLUMNS,
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <span style={headerCell}>Learner</span>
        <span style={headerCell}>Cohort</span>
        <span style={headerCell}>Signal</span>
        <span style={headerCell}>Stale</span>
        <span style={{ ...headerCell, textAlign: 'right' }}>Actions</span>
      </div>
      {rows.map((r) => (
        <ExceptionTableRow
          key={r.learner}
          {...r}
          onAct={() => {}}
          onOpen={() => {}}
          onSnooze={() => {}}
        />
      ))}
    </>
  ),
};
