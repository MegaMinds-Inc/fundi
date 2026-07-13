import type { Meta, StoryObj } from '@storybook/nextjs';
import { AuthFlow } from './AuthFlow';

const meta = {
  title: 'Modules/AuthFlow',
  component: AuthFlow,
  args: {
    appName: 'your Creator dashboard',
    onSuccess: () => {},
    onRequestOtp: async () => {},
  },
  decorators: [(Story) => <div style={{ width: 360, margin: '0 auto' }}>{Story()}</div>],
} satisfies Meta<typeof AuthFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Full interactive flow. Demo code is `000000` — enter any 9–12 digit number, then 000000. */
export const Default: Story = {};

/** Creator context. */
export const Creator: Story = { args: { appName: 'your Creator dashboard' } };

/** Same component, learner context — only `appName` differs. */
export const Learner: Story = { args: { appName: 'your Learner home' } };

/** Verifier always rejects — reach the OTP step and enter any code to see the retry error. */
export const RejectsCode: Story = {
  args: { onVerifyOtp: async () => false },
};
