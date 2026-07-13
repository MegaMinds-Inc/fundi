import type { Meta, StoryObj } from '@storybook/nextjs';
import { DraftQueue, type Draft } from './DraftQueue';

const DRAFTS: Draft[] = [
  {
    id: '1',
    kind: 'reminder',
    recipient: 'Ama Mensah',
    minutesAgo: 12,
    text: 'Hi Ama, lesson 3 is ready for you.',
    variables: { first_name: 'Ama' },
  },
  {
    id: '2',
    kind: 'check-in',
    recipient: 'Kofi Owusu',
    minutesAgo: 47,
    text: 'Hi Kofi — how did the last quiz feel? Happy to go over anything.',
    variables: {},
  },
  {
    id: '3',
    kind: 'broadcast',
    recipient: 'Cohort A',
    minutesAgo: 120,
    text: 'Reminder: live session this Friday at 6pm.',
    variables: {},
  },
];

const meta = {
  title: 'Modules/DraftQueue',
  component: DraftQueue,
  args: { drafts: [], onReview: () => {} },
  decorators: [(Story) => <div style={{ maxWidth: 460 }}>{Story()}</div>],
} satisfies Meta<typeof DraftQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: { drafts: DRAFTS } };
export const Empty: Story = { args: { drafts: [] } };
