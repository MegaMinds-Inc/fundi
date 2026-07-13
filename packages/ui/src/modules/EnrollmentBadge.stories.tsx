import type { Meta, StoryObj } from '@storybook/nextjs';
import { EnrollmentBadge } from './EnrollmentBadge';

const meta = {
  title: 'Modules/EnrollmentBadge',
  component: EnrollmentBadge,
  argTypes: { compact: { control: 'boolean' } },
  args: { state: 'active' },
} satisfies Meta<typeof EnrollmentBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <EnrollmentBadge state="pending_approval" />
      <EnrollmentBadge state="active" />
      <EnrollmentBadge state="completed" />
      <EnrollmentBadge state="dropped" />
    </div>
  ),
};

export const Compact: Story = { args: { compact: true } };
