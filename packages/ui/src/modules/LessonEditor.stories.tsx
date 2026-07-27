import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LessonEditor } from './LessonEditor';
import type { EditableLesson } from './LessonEditor';

/** Positioned, clipped stage so the preview Drawer / confirm Modal (both `position:absolute`) are contained. */
const stage = (Story: () => ReactNode) => (
  <div
    style={{
      position: 'relative',
      width: 560,
      maxWidth: '100%',
      minHeight: 560,
      margin: '0 auto',
      background: 'var(--color-bg-surface)',
      border: '1px dashed var(--color-border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}
  >
    {Story()}
  </div>
);

const meta = {
  title: 'Modules/LessonEditor',
  component: LessonEditor,
  args: {
    lesson: null,
    moduleTitle: 'Foundations',
    onChange: () => {},
    onDelete: () => {},
  },
  decorators: [stage],
} satisfies Meta<typeof LessonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Stateful harness so edits and the type-switch flow are live. */
function Harness({ initial }: { initial: EditableLesson }) {
  const [lesson, setLesson] = useState<EditableLesson>(initial);
  return <LessonEditor lesson={lesson} moduleTitle="Foundations" onChange={setLesson} onDelete={() => {}} />;
}

/** No lesson selected. */
export const NoSelection: Story = { args: { lesson: null } };

export const TextLesson: Story = {
  render: () => <Harness initial={{ id: 'l1', title: 'Why copy matters', type: 'text', body: 'Good copy is a conversation, not a broadcast…' }} />,
};

export const VideoLesson: Story = {
  render: () => <Harness initial={{ id: 'l2', title: 'Watch: a great sales page', type: 'video', videoUrl: 'https://youtube.com/watch?v=abc', duration: '6:12' }} />,
};

/** Attachment — the drop-zone is deferred (no object storage); rendered disabled. */
export const AttachmentLesson: Story = {
  render: () => <Harness initial={{ id: 'l3', title: 'Worksheet', type: 'attachment', fileName: 'copywriting-worksheet.pdf', fileSize: '1.2 MB' }} />,
};

export const LiveOnlineLesson: Story = {
  render: () => <Harness initial={{ id: 'l4', title: 'Group call', type: 'live_online', when: 'Thursday, 6:00 PM WAT', where: 'https://meet.google.com/abc-defg-hij' }} />,
};

export const InPersonLesson: Story = {
  render: () => <Harness initial={{ id: 'l5', title: 'Meetup in Accra', type: 'in_person', when: 'Saturday, 10:00 AM', where: 'Impact Hub, Osu' }} />,
};

/**
 * The type-switch confirm Modal — shown by mounting a Text lesson with body
 * content, then clicking the "Video" type pill (which would discard it). Driven
 * by a small mount effect, not a Storybook play runner.
 */
export const TypeSwitchModal: Story = {
  render: () => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const tag = Array.from(ref.current?.querySelectorAll<HTMLElement>('span') ?? []).find((el) => el.textContent === 'Video');
      tag?.click();
    }, []);
    return (
      <div ref={ref}>
        <Harness initial={{ id: 'l1', title: 'Why copy matters', type: 'text', body: 'A draft with content that switching away would discard.' }} />
      </div>
    );
  },
};

/** Text lesson on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  render: () => <Harness initial={{ id: 'l1', title: 'Why copy matters', type: 'text', body: 'Good copy is a conversation, not a broadcast…' }} />,
};
