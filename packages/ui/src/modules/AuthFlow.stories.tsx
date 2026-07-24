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

/**
 * Step-up re-auth (0010 §12.4), pinned via `initialStep`. Returning-user screen:
 * no SMS affordances. Demo PIN is `135790`; any other 6 digits shows the generic
 * wrong-PIN error. "Not you?" clears device trust → phone; "Forgot PIN?" would
 * trigger a server-driven reset OTP.
 */
export const PinEntry: Story = {
  args: { initialStep: 'pin-entry' },
};

/** Same PIN-entry screen, personalised greeting from the server-resolved name. */
export const PinEntryNamed: Story = {
  args: { initialStep: 'pin-entry', displayName: 'Ama' },
};

/** PIN entry on the learner light theme. */
export const PinEntryLight: Story = {
  globals: { theme: 'light' },
  args: { initialStep: 'pin-entry', appName: 'your Learner home' },
};

/**
 * Post-reset PIN setup (0010 §12.5): enter → confirm. The client-side weak-PIN
 * guard rejects repeats and runs (e.g. `123456`, `000000`); a mismatch on
 * confirm restarts the cycle. Demo `onSetPin` accepts any strong, matching PIN.
 */
export const PinSetup: Story = {
  args: { initialStep: 'pin-setup' },
};

/** PIN setup on the learner light theme. */
export const PinSetupLight: Story = {
  globals: { theme: 'light' },
  args: { initialStep: 'pin-setup', appName: 'your Learner home' },
};

/**
 * Forgot-PIN reset (0010 §4.6/§12.6). Start on PIN entry and click "Forgot PIN?":
 * that fires the server-driven reset SMS, then AuthFlow drives an OTP(reset) →
 * new-PIN sub-flow — no phone shown, no "Change number", no resend, no second
 * send — and submits the code + new PIN together via `onResetPin`. Enter any 6
 * digits for the code, then choose + confirm a strong PIN. Demo `onResetPin`
 * accepts any strong, matching PIN.
 */
export const ForgotPinReset: Story = {
  args: {
    initialStep: 'pin-entry',
    onForgotPin: async () => {},
    onResetPin: async () => true,
  },
};

/** The same forgot-PIN reset flow on the learner light theme. */
export const ForgotPinResetLight: Story = {
  globals: { theme: 'light' },
  args: {
    initialStep: 'pin-entry',
    appName: 'your Learner home',
    onForgotPin: async () => {},
    onResetPin: async () => true,
  },
};
