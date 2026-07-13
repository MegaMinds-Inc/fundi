import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '../components/Button';
import { ActionSheet } from './ActionSheet';

const stage = (Story: () => ReactNode) => (
  <div
    style={{
      position: 'relative',
      width: 390,
      height: 620,
      margin: '0 auto',
      border: '1px dashed var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--color-bg-sunken)',
      overflow: 'hidden',
    }}
  >
    {Story()}
  </div>
);

const meta = {
  title: 'Modules/ActionSheet',
  component: ActionSheet,
  args: {
    open: true,
    learner: 'Ama Mensah',
    cohort: 'COHORT A · +233 20 000 0000',
    signal: 'lesson_overdue',
    draft:
      "Hi Ama, noticed you haven't started lesson 3 yet — everything okay? Reply here and I can help.",
    onClose: () => {},
    onSend: () => {},
    onResolve: () => {},
    onSnooze: () => {},
  },
  decorators: [stage],
} satisfies Meta<typeof ActionSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

/** Trigger it, edit the draft, then Snooze (popover) / Send / Mark resolved. */
export const Interactive: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Take action</Button>
        <ActionSheet
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          onSend={() => setOpen(false)}
          onResolve={() => setOpen(false)}
          onSnooze={() => setOpen(false)}
        />
      </>
    );
  },
};
