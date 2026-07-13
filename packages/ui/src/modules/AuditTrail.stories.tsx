import type { Meta, StoryObj } from '@storybook/nextjs';
import { AuditTrail, type AuditEntry } from './AuditTrail';

const ENTRIES: AuditEntry[] = [
  {
    id: '1',
    action: 'sent',
    recipient: 'Ama Mensah',
    text: 'Hi Ama, lesson 3 is ready whenever you are.',
    when: '2h ago',
  },
  {
    id: '2',
    action: 'sent_unedited',
    recipient: 'Kofi Owusu',
    text: 'Checking in — how did the quiz feel?',
    when: 'yesterday',
  },
  {
    id: '3',
    action: 'rejected',
    recipient: 'Yaa Asantewaa',
    text: 'Draft discarded — tone felt off.',
    when: '2d ago',
  },
];

const meta = {
  title: 'Modules/AuditTrail',
  component: AuditTrail,
  args: { entries: [] },
  decorators: [(Story) => <div style={{ maxWidth: 460 }}>{Story()}</div>],
} satisfies Meta<typeof AuditTrail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = { args: { entries: ENTRIES } };
export const Empty: Story = { args: { entries: [] } };
