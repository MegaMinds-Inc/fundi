import type { Meta, StoryObj } from '@storybook/nextjs';
import { DraftCard } from './DraftCard';

const meta = {
  title: 'Modules/DraftCard',
  component: DraftCard,
  args: {
    kind: 'reminder',
    recipient: 'Ama Mensah',
    minutesAgo: 12,
    text: 'Hi Ama, just a reminder that lesson 3 (Mobile Money) is ready for you whenever you have a moment. Reply here if anything is unclear.',
    onReview: () => {},
  },
  decorators: [(Story) => <div style={{ maxWidth: 440 }}>{Story()}</div>],
} satisfies Meta<typeof DraftCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reminder: Story = {};
export const CheckIn: Story = {
  args: { kind: 'check-in', text: 'Hi Kofi — checking in, how did the last quiz feel?' },
};
export const Broadcast: Story = { args: { kind: 'broadcast', recipient: 'Cohort A' } };
