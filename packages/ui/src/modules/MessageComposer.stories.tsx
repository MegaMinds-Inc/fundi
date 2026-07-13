import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { MessageComposer } from './MessageComposer';

const meta = {
  title: 'Modules/MessageComposer',
  component: MessageComposer,
  args: {
    value: '',
    onChange: () => {},
    onSend: () => {},
    sendLabel: 'Send on WhatsApp',
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}>{Story()}</div>],
} satisfies Meta<typeof MessageComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({
  start = '',
  ...args
}: { start?: string } & Partial<ComponentProps<typeof MessageComposer>>) {
  const [value, setValue] = useState(start);
  return (
    <MessageComposer {...args} value={value} onChange={setValue} onSend={() => setValue('')} />
  );
}

/** Send stays disabled until the message is non-empty. */
export const Default: Story = { render: (args) => <Controlled {...args} /> };

export const Prefilled: Story = {
  render: (args) => <Controlled {...args} start="Hi Ama — just checking in on lesson 3." />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Controlled {...args} start="Sending…" />,
};
