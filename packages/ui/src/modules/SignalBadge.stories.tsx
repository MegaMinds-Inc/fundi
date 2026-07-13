import type { Meta, StoryObj } from '@storybook/nextjs';
import type { SignalType } from '@fundi/types';
import { SignalBadge } from './SignalBadge';

const meta = {
  title: 'Modules/SignalBadge',
  component: SignalBadge,
  argTypes: { compact: { control: 'boolean' } },
  args: { signal: 'lesson_overdue' },
} satisfies Meta<typeof SignalBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** One per Signal type, plus a deliberately-invalid key to prove the fallback. */
export const AllTypes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <SignalBadge signal="lesson_overdue" />
      <SignalBadge signal="reminder_unacknowledged" />
      <SignalBadge signal="quiz_failed" />
      <SignalBadge signal="help_requested" />
      <SignalBadge signal="went_quiet" />
      <SignalBadge signal={'mystery_key' as unknown as SignalType} />
    </div>
  ),
};

export const Compact: Story = { args: { compact: true } };
