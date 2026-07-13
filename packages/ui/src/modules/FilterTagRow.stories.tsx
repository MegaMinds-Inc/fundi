import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { FilterTagRow, type FilterTagOption } from './FilterTagRow';

const OPTIONS = [
  { value: null, label: 'All' },
  { value: 'overdue', label: 'Lesson overdue', color: 'amber' },
  { value: 'quiz', label: 'Quiz failed', color: 'red' },
  { value: 'help', label: 'Asked for help', color: 'teal' },
  { value: 'quiet', label: 'Went quiet', color: 'neutral' },
] satisfies FilterTagOption[];

const meta = {
  title: 'Modules/FilterTagRow',
  component: FilterTagRow,
  args: { options: [], value: null, onChange: () => {} },
  decorators: [(Story) => <div style={{ maxWidth: 340 }}>{Story()}</div>],
} satisfies Meta<typeof FilterTagRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Overflows the container — scroll right (fade + snap, hidden scrollbar). */
export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | null>(null);
    return <FilterTagRow {...args} options={OPTIONS} value={value} onChange={setValue} />;
  },
};
