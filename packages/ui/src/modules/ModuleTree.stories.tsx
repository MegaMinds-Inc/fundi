import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { ModuleTree } from './ModuleTree';
import type { ModuleTreeModule, ModulePatch } from './ModuleTree';

/** Narrow panel, like the builder's left rail. */
const rail = (Story: () => ReactNode) => (
  <div style={{ maxWidth: 340, padding: 12, background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)' }}>{Story()}</div>
);

const meta = {
  title: 'Modules/ModuleTree',
  component: ModuleTree,
  args: {
    modules: [],
    coverStyle: 'gradient',
    activeLessonId: null,
    onSelectLesson: () => {},
    onMoveLesson: () => {},
    onMoveModule: () => {},
    onAddLesson: () => {},
    onAddModule: () => {},
    onRenameModule: () => {},
    onUpdateModule: () => {},
  },
  decorators: [rail],
} satisfies Meta<typeof ModuleTree>;

export default meta;
type Story = StoryObj<typeof meta>;

const SEED: ModuleTreeModule[] = [
  {
    id: 'm1',
    title: 'Foundations',
    description: 'The core ideas everything else builds on.',
    unlockMode: 'immediate',
    lessons: [
      { id: 'l1', title: 'Why copy matters', type: 'text' },
      { id: 'l2', title: 'Watch: a great sales page', type: 'video' },
      { id: 'l3', title: 'Worksheet', type: 'attachment' },
    ],
  },
  {
    id: 'm2',
    title: 'Live workshop',
    unlockMode: 'after_days',
    unlockDays: 7,
    lessons: [
      { id: 'l4', title: 'Group call', type: 'live_online' },
      { id: 'l5', title: 'Meetup in Accra', type: 'in_person' },
    ],
  },
];

/** Stateful harness — wires the callbacks so reorder / rename / settings edits mutate in place. */
function Harness({ initial, activeLessonId }: { initial: ModuleTreeModule[]; activeLessonId?: string | null }) {
  const [modules, setModules] = useState(initial);

  const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = arr.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  return (
    <ModuleTree
      modules={modules}
      coverStyle="gradient"
      activeLessonId={activeLessonId}
      onSelectLesson={() => {}}
      onMoveModule={(idx, dir) => setModules((ms) => move(ms, idx, dir))}
      onMoveLesson={(moduleId, lessonIdx, dir) =>
        setModules((ms) => ms.map((m) => (m.id === moduleId ? { ...m, lessons: move(m.lessons, lessonIdx, dir) } : m)))
      }
      onAddModule={() => setModules((ms) => [...ms, { id: 'm' + (ms.length + 1), title: 'New module', lessons: [] }])}
      onAddLesson={(moduleId) =>
        setModules((ms) =>
          ms.map((m) =>
            m.id === moduleId ? { ...m, lessons: [...m.lessons, { id: 'l' + Date.now(), title: 'New lesson', type: 'text' }] } : m,
          ),
        )
      }
      onRenameModule={(moduleId, title) => setModules((ms) => ms.map((m) => (m.id === moduleId ? { ...m, title } : m)))}
      onUpdateModule={(moduleId, patch: ModulePatch) => setModules((ms) => ms.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)))}
    />
  );
}

/** Zero-state — prompts the first module. */
export const Empty: Story = {};

/** A couple of modules with mixed lesson types; caret up/down reorders in place. */
export const Populated: Story = {
  render: () => <Harness initial={SEED} activeLessonId="l2" />,
};

/**
 * The per-module settings sub-panel, opened on mount (description + unlock/visibility
 * row + the conditional after-days input). Uses a small mount effect to click the
 * first module's settings toggle — no Storybook play runner.
 */
export const SettingsOpen: Story = {
  render: () => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const btn = ref.current?.querySelector<HTMLElement>('[aria-label="Module settings"]');
      btn?.click();
    }, []);
    return (
      <div ref={ref}>
        <Harness initial={SEED} />
      </div>
    );
  },
};

/**
 * A module set to the ADR-014 `hidden` visibility gate — dimmed block + eye-slash
 * indicator on the header, distinct from the timing modes.
 */
export const HiddenModule: Story = {
  render: () => (
    <Harness
      initial={[
        SEED[0],
        { id: 'm3', title: 'Bonus (not yet live)', unlockMode: 'hidden', lessons: [{ id: 'l9', title: 'Draft lesson', type: 'text' }] },
      ]}
    />
  ),
};

/** Populated tree on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  render: () => <Harness initial={SEED} activeLessonId="l1" />,
};
