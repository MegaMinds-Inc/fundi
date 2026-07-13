import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import type { SignalType } from '@fundi/types';
import { FilterSortBar } from './FilterSortBar';

const meta = {
  title: 'Modules/FilterSortBar',
  component: FilterSortBar,
  args: {
    signalFilter: null,
    onSignalFilter: () => {},
    sort: 'oldest',
    onSort: () => {},
    resultCount: 5,
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}>{Story()}</div>],
} satisfies Meta<typeof FilterSortBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full bar — filter by signal (scrollable), sort toggle, live result count. */
export const Default: Story = {
  render: (args) => {
    const [filter, setFilter] = useState<SignalType | null>(null);
    const [sort, setSort] = useState<'newest' | 'oldest'>('oldest');
    return (
      <FilterSortBar
        {...args}
        signalFilter={filter}
        onSignalFilter={setFilter}
        sort={sort}
        onSort={setSort}
      />
    );
  },
};
