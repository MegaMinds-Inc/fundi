import type { Meta, StoryObj } from '@storybook/nextjs';
import { OfflineBanner } from './OfflineBanner';

const meta = {
  title: 'Components/OfflineBanner',
  component: OfflineBanner,
  argTypes: {
    tone: { control: 'inline-radio', options: ['warn', 'neutral'] },
    message: { control: 'text' },
    retryLabel: { control: 'text' },
    retrying: { control: 'boolean' },
  },
  args: {
    tone: 'warn',
    onRetry: () => {},
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}>{Story()}</div>],
} satisfies Meta<typeof OfflineBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default transient-connectivity surface (plan B.3) — session preserved, no dead end. */
export const Default: Story = {};

/** With a retry affordance. */
export const WithRetry: Story = {
  args: { retryLabel: 'Retry' },
};

/** Retry in flight — the button shows its spinner and blocks a second press. */
export const Retrying: Story = {
  args: { retryLabel: 'Retry', retrying: true },
};

/** Quiet, informational tone. */
export const Neutral: Story = {
  args: {
    tone: 'neutral',
    icon: 'ph-info',
    message: 'Reconnecting… your work is saved.',
    retryLabel: 'Retry',
  },
};

/** Light theme (learner PWA renders light) — verify contrast holds (design-QA gate B.8). */
export const Light: Story = {
  args: { retryLabel: 'Retry' },
  globals: { theme: 'light' },
};

/** Dark theme (creator PWA default). */
export const Dark: Story = {
  args: { retryLabel: 'Retry' },
  globals: { theme: 'dark' },
};
