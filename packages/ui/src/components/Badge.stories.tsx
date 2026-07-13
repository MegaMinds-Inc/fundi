import type { Meta, StoryObj } from '@storybook/nextjs';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  argTypes: {
    tone: { control: 'inline-radio', options: ['live', 'draft', 'warn', 'danger', 'neutral'] },
    children: { control: 'text' },
  },
  args: { children: 'Live', tone: 'live' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every tone at once — the full status vocabulary. */
export const AllTones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge tone="live">Live</Badge>
      <Badge tone="draft">Draft</Badge>
      <Badge tone="warn">Overdue</Badge>
      <Badge tone="danger">At risk</Badge>
      <Badge tone="neutral">Archived</Badge>
    </div>
  ),
};
