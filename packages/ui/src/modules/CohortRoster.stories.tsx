import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { CohortRoster, type Cohort } from './CohortRoster';

const COHORTS: Cohort[] = [
  {
    id: 'a',
    name: 'Cohort A',
    schedule: 'Mon / Wed',
    roster: [
      { name: 'Ama Mensah', progressPercent: 80, state: 'active' },
      { name: 'Kofi Owusu', progressPercent: 35, state: 'active' },
      { name: 'Yaa Asantewaa', progressPercent: 100, state: 'completed' },
      { name: 'Kwame Boateng', progressPercent: 0, state: 'dropped' },
    ],
  },
  { id: 'b', name: 'Cohort B', roster: [] },
];

const meta = {
  title: 'Modules/CohortRoster',
  component: CohortRoster,
  args: { cohorts: [], activeId: '', onSelect: () => {} },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}>{Story()}</div>],
} satisfies Meta<typeof CohortRoster>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Auto — follows the viewport: table at ≥1200px, card list below (try the
 *  Storybook viewport toolbar). Cohort B is empty → empty state. */
export const Auto: Story = {
  render: (args) => {
    const [id, setId] = useState('a');
    return (
      <CohortRoster {...args} cohorts={COHORTS} activeId={id} onSelect={setId} layout="auto" />
    );
  },
};

/** Card list, forced. */
export const Cards: Story = {
  render: (args) => {
    const [id, setId] = useState('a');
    return (
      <CohortRoster {...args} cohorts={COHORTS} activeId={id} onSelect={setId} layout="cards" />
    );
  },
};

/** Dense table, forced. */
export const Table: Story = {
  render: (args) => {
    const [id, setId] = useState('a');
    return (
      <CohortRoster {...args} cohorts={COHORTS} activeId={id} onSelect={setId} layout="table" />
    );
  },
};

export const NoCohorts: Story = {
  render: (args) => <CohortRoster {...args} cohorts={[]} activeId="" onSelect={() => {}} />,
};
