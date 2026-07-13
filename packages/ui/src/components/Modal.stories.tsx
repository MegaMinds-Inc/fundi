import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * Modal positions `absolute` within the nearest positioned ancestor, so every
 * story renders inside a bordered `position: relative` stage that stands in for
 * the app shell it normally lives in.
 */
const meta = {
  title: 'Components/Modal',
  component: Modal,
  argTypes: {
    open: { control: 'boolean' },
  },
  args: {
    open: true,
    title: 'Invite learner',
    children: (
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
        Send an invite to Ama Mensah to join this program? They&apos;ll get a WhatsApp message.
      </p>
    ),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: 460,
          border: '1px dashed var(--color-border-subtle)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-sunken)',
          overflow: 'hidden',
        }}
      >
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    footer: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button>Send invite</Button>
      </>
    ),
  },
};

/** Click the trigger to open — exercises the open/close + scrim-dismiss flow. */
export const Interactive: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Invite learner</Button>
        <Modal
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Send invite</Button>
            </>
          }
        />
      </>
    );
  },
};
