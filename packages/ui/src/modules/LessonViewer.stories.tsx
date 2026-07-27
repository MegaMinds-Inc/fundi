import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LessonViewer } from './LessonViewer';

/** Reader-width column, like the preview drawer body. */
const column = (Story: () => ReactNode) => (
  <div
    style={{
      maxWidth: 460,
      padding: 20,
      background: 'var(--color-bg-surface)',
      borderRadius: 'var(--radius-lg)',
    }}
  >
    {Story()}
  </div>
);

const meta = {
  title: 'Modules/LessonViewer',
  component: LessonViewer,
  args: { lesson: { title: '', type: 'text' }, onDone: () => {} },
  decorators: [column],
} satisfies Meta<typeof LessonViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: {
    lesson: {
      moduleTitle: 'Foundations',
      title: 'Why copy matters',
      type: 'text',
      body: 'Good copy is a conversation, not a broadcast. Before you write a word, know who you are talking to and what they want to hear.',
    },
  },
};

export const Video: Story = {
  args: {
    lesson: {
      moduleTitle: 'Foundations',
      title: 'Watch: a great sales page',
      type: 'video',
      duration: '6:12',
    },
  },
};

export const Attachment: Story = {
  args: {
    lesson: {
      moduleTitle: 'Foundations',
      title: 'Worksheet',
      type: 'attachment',
      name: 'copywriting-worksheet.pdf',
      size: '1.2 MB',
    },
  },
};

export const Live: Story = {
  args: {
    lesson: {
      moduleTitle: 'Live workshop',
      title: 'Group call',
      type: 'live_online',
      when: 'Thursday, 6:00 PM WAT',
      where: 'https://meet.google.com/abc-defg-hij',
    },
  },
};

/** Text lesson on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  args: {
    lesson: {
      moduleTitle: 'Foundations',
      title: 'Why copy matters',
      type: 'text',
      body: 'Good copy is a conversation, not a broadcast.',
    },
  },
};
