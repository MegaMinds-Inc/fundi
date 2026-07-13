import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '../components/Button';
import { DraftEditor, type EditableDraft } from './DraftEditor';

const SAMPLE: EditableDraft = {
  id: '1',
  kind: 'reminder',
  recipient: 'Ama Mensah',
  templateName: 'lesson_reminder_v2',
  text: 'Hi Ama, lesson 3 (Mobile Money) is ready for you whenever you have a moment.',
  variables: { first_name: 'Ama', lesson: 'Mobile Money 3' },
};

const stage = (Story: () => ReactNode) => (
  <div
    style={{
      position: 'relative',
      width: 390,
      height: 600,
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
  title: 'Modules/DraftEditor',
  component: DraftEditor,
  args: { open: true, draft: SAMPLE, onClose: () => {}, onApprove: () => {}, onReject: () => {} },
  decorators: [stage],
} satisfies Meta<typeof DraftEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Template variables show as locked chips above the editable text. */
export const Open: Story = {};

export const NoVariables: Story = { args: { draft: { ...SAMPLE, variables: {} } } };

/** Null draft renders the sheet closed — no crash, no stale content. */
export const NullDraft: Story = { args: { draft: null } };

export const Interactive: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Review draft</Button>
        <DraftEditor
          {...args}
          open={open}
          draft={SAMPLE}
          onClose={() => setOpen(false)}
          onApprove={() => setOpen(false)}
          onReject={() => setOpen(false)}
        />
      </>
    );
  },
};
