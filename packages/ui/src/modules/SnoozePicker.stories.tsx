import type { Meta, StoryObj } from '@storybook/nextjs';
import { SnoozePicker } from './SnoozePicker';

const meta = {
  title: 'Modules/SnoozePicker',
  component: SnoozePicker,
  args: { onSnooze: () => {} },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}>{Story()}</div>],
} satisfies Meta<typeof SnoozePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three options; "3 days" is marked as the default. */
export const Default: Story = {};
