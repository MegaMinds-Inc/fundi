import type { Meta, StoryObj } from '@storybook/nextjs';
import { LearnerPreview } from './LearnerPreview';
import type { LearnerPreviewProgram } from './LearnerPreview';

const meta = {
  title: 'Modules/LearnerPreview',
  component: LearnerPreview,
} satisfies Meta<typeof LearnerPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A program with an `immediate` module, two locked modules (`after_previous`,
 * `after_days`), and one `hidden` module. The hidden module ("Bonus — internal
 * only") MUST NOT appear in the rendered preview (ADR-014 filter), so this story
 * doubles as the visual assertion that it is absent — only three cards render.
 */
const PROGRAM: LearnerPreviewProgram = {
  title: 'Copywriting that converts',
  coverStyle: 'gradient',
  modules: [
    {
      id: 'm1',
      title: 'Foundations',
      description: 'The core ideas everything else builds on.',
      unlockMode: 'immediate',
      lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }],
    },
    {
      id: 'm2',
      title: 'The persuasion toolkit',
      description: 'Frameworks you can reach for on any page.',
      unlockMode: 'after_previous',
      lessons: [{ id: 'l4' }, { id: 'l5' }],
    },
    {
      id: 'm3',
      title: 'Live teardown workshop',
      unlockMode: 'after_days',
      unlockDays: 7,
      lessons: [{ id: 'l6' }],
    },
    {
      // ADR-014: hidden → must be filtered out; should NOT render below.
      id: 'm4',
      title: 'Bonus — internal only',
      description: 'This module is hidden and should never reach a learner.',
      unlockMode: 'hidden',
      lessons: [{ id: 'l7' }, { id: 'l8' }],
    },
  ],
};

/** Immediate + locked + a hidden module (hidden one is absent). */
export const Mixed: Story = {
  args: { program: PROGRAM },
};

/** `after_days` with a single day — verifies the "1 day" (no plural) caption. */
export const SingleDayUnlock: Story = {
  args: {
    program: {
      title: 'Starter series',
      coverStyle: 'geometric',
      modules: [
        { id: 'a', title: 'Welcome', unlockMode: 'immediate', lessons: [{ id: 'x1' }] },
        {
          id: 'b',
          title: 'Day two drop',
          unlockMode: 'after_days',
          unlockDays: 1,
          lessons: [{ id: 'x2' }],
        },
      ],
    },
  },
};

/** Same mixed program on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  args: { program: PROGRAM },
};
