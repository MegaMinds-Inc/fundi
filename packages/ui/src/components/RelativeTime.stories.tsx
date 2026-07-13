import type { Meta, StoryObj } from '@storybook/nextjs';
import { RelativeTime } from './RelativeTime';

const meta = {
  title: 'Components/RelativeTime',
  component: RelativeTime,
  args: { minutesAgo: 5 },
} satisfies Meta<typeof RelativeTime>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Scale: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <RelativeTime minutesAgo={0} />
      <RelativeTime minutesAgo={5} />
      <RelativeTime hoursAgo={3} />
      <RelativeTime hoursAgo={30} />
    </div>
  ),
};
