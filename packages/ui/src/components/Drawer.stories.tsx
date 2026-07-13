import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Badge } from './Badge';
import { Button } from './Button';
import { Drawer } from './Drawer';

/**
 * Drawer is the mobile-first bottom action sheet; like Modal it positions
 * `absolute`, so stories render inside a phone-width `position: relative` stage.
 */
const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  argTypes: {
    open: { control: 'boolean' },
  },
  args: {
    open: true,
    title: 'Ama Mensah',
    subtitle: 'COHORT A · +233 20 000 0000',
    signalSlot: <Badge tone="warn">Lesson overdue</Badge>,
    children: (
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
        Two lessons are overdue. Send a reminder now, or snooze until later.
      </p>
    ),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: 380,
          height: 560,
          margin: '0 auto',
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
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    footer: (
      <>
        <Button style={{ width: '100%' }}>Send reminder</Button>
        <Button variant="secondary" style={{ width: '100%' }}>
          Snooze 1 day
        </Button>
      </>
    ),
  },
};

/** Tap the trigger to slide the sheet up. */
export const Interactive: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open action sheet</Button>
        <Drawer
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button style={{ width: '100%' }} onClick={() => setOpen(false)}>
                Send reminder
              </Button>
              <Button variant="secondary" style={{ width: '100%' }} onClick={() => setOpen(false)}>
                Snooze 1 day
              </Button>
            </>
          }
        />
      </>
    );
  },
};
