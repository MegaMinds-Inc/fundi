import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { SortToggle } from './SortToggle';

const meta = {
  title: 'Modules/SortToggle',
  component: SortToggle,
  args: { sort: 'oldest', onSort: () => {} },
} satisfies Meta<typeof SortToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [sort, setSort] = useState<'newest' | 'oldest'>('oldest');
    return <SortToggle {...args} sort={sort} onSort={setSort} />;
  },
};
