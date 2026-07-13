import type { Meta, StoryObj } from '@storybook/nextjs';
import { RosterRow } from './RosterRow';

const meta = {
  title: 'Modules/RosterRow',
  component: RosterRow,
  argTypes: {
    dense: { control: 'boolean' },
    progressPercent: { control: { type: 'range', min: 0, max: 100 } },
  },
  args: { name: 'Ama Mensah', progressPercent: 60, state: 'active' },
  decorators: [(Story) => <div style={{ maxWidth: 460 }}>{Story()}</div>],
} satisfies Meta<typeof RosterRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Stacked card cell (mobile). */
export const Card: Story = {};

/** Dense table-row layout. */
export const Dense: Story = { args: { dense: true } };

export const Completed: Story = { args: { state: 'completed', progressPercent: 100 } };
