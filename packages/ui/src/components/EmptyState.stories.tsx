import type { Meta, StoryObj } from '@storybook/nextjs';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  argTypes: {
    tone: { control: 'inline-radio', options: ['primary', 'neutral'] },
    icon: { control: 'text' },
  },
  args: {
    icon: 'ph-check-circle',
    title: "You're all caught up",
    body: 'No learners need your attention right now.',
    tone: 'primary',
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}>{Story()}</div>],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Reassuring "nothing to do" confirmation — the primary tone. */
export const Primary: Story = {};

/** Muted tone for a genuinely empty list, e.g. before anything is created. */
export const Neutral: Story = {
  args: {
    icon: 'ph-tray',
    title: 'No programs yet',
    body: 'Create your first program to start enrolling learners.',
    tone: 'neutral',
  },
};
