import type { Meta, StoryObj } from '@storybook/nextjs';
import { AuditRow } from './AuditRow';

const meta = {
  title: 'Modules/AuditRow',
  component: AuditRow,
  argTypes: { action: { control: 'inline-radio', options: ['sent', 'sent_unedited', 'rejected'] } },
  args: {
    action: 'sent',
    recipient: 'Ama Mensah',
    text: 'Hi Ama, lesson 3 is ready whenever you are.',
    when: '2h ago',
  },
  decorators: [(Story) => <div style={{ maxWidth: 460 }}>{Story()}</div>],
} satisfies Meta<typeof AuditRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sent: Story = {};
export const SentUnedited: Story = { args: { action: 'sent_unedited', when: 'yesterday' } };
export const Rejected: Story = {
  args: {
    action: 'rejected',
    text: 'Draft discarded — the tone felt off for this learner.',
    when: '2d ago',
  },
};
