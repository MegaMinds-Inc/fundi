import type { Meta, StoryObj } from '@storybook/nextjs';
import { ExceptionCard } from './ExceptionCard';

const meta = {
  title: 'Modules/ExceptionCard',
  component: ExceptionCard,
  args: {
    learner: 'Ama Mensah',
    cohort: 'COHORT A',
    signal: 'lesson_overdue',
    hoursAgo: 5,
    onAct: () => {},
    onOpen: () => {},
    onSnooze: () => {},
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}>{Story()}</div>],
} satisfies Meta<typeof ExceptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSuggestion: Story = {
  args: { suggestion: 'Send a nudge about lesson 3 — she was active last week.' },
};

export const HelpRequested: Story = {
  args: { signal: 'help_requested', suggestion: 'Ama asked how to submit the worksheet.' },
};

export const LongName: Story = {
  args: { learner: 'Akosua Serwaa Boateng-Amankwah', hoursAgo: 52 },
};
