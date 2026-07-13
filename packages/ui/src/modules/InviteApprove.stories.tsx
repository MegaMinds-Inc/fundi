import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { InviteApprove, type PendingInvite } from './InviteApprove';

const meta = {
  title: 'Modules/InviteApprove',
  component: InviteApprove,
  args: { pending: [], onApprove: () => {}, onDecline: () => {}, onInvite: () => {} },
  decorators: [(Story) => <div style={{ maxWidth: 460 }}>{Story()}</div>],
} satisfies Meta<typeof InviteApprove>;

export default meta;
type Story = StoryObj<typeof meta>;

const SEED: PendingInvite[] = [
  { id: '1', name: 'Ama Mensah', phone: '+233 20 000 0000', hoursAgo: 3 },
  { id: '2', name: 'Kofi Owusu', phone: '+233 24 111 2222', hoursAgo: 26 },
];

/** Approve/Decline visibly remove the entry from the pending list. */
export const Populated: Story = {
  render: (args) => {
    const [pending, setPending] = useState(SEED);
    const remove = (id: string) => setPending((list) => list.filter((p) => p.id !== id));
    return (
      <InviteApprove
        {...args}
        pending={pending}
        onApprove={remove}
        onDecline={remove}
        onInvite={() => {}}
      />
    );
  },
};

export const Empty: Story = { args: { pending: [] } };
