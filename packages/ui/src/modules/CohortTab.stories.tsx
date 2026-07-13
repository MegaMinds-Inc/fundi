import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { CohortTab } from './CohortTab';

const meta = {
  title: 'Modules/CohortTab',
  component: CohortTab,
  args: { name: 'Cohort A', count: 12, active: true, onSelect: () => {} },
} satisfies Meta<typeof CohortTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {};
export const Inactive: Story = { args: { active: false } };

/** A selectable row of cohort tabs. */
export const Row: Story = {
  render: () => {
    const tabs = [
      { id: 'a', name: 'Cohort A', count: 12 },
      { id: 'b', name: 'Cohort B', count: 4 },
      { id: 'c', name: 'Evening group', count: 0 },
    ];
    const [activeId, setActiveId] = useState('a');
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {tabs.map((t) => (
          <CohortTab
            key={t.id}
            name={t.name}
            count={t.count}
            active={activeId === t.id}
            onSelect={() => setActiveId(t.id)}
          />
        ))}
      </div>
    );
  },
};
