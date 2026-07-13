import type { Meta, StoryObj } from '@storybook/nextjs';
import { PendingInviteRow } from './PendingInviteRow';

const meta = {
  title: 'Modules/PendingInviteRow',
  component: PendingInviteRow,
  args: {
    name: 'Ama Mensah',
    phone: '+233 20 000 0000',
    hoursAgo: 3,
    onApprove: () => {},
    onDecline: () => {},
  },
  decorators: [(Story) => <div style={{ maxWidth: 440 }}>{Story()}</div>],
} satisfies Meta<typeof PendingInviteRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongName: Story = { args: { name: 'Akosua Serwaa Boateng-Amankwah', hoursAgo: 26 } };
