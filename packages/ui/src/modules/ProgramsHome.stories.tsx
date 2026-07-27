import type { Meta, StoryObj } from '@storybook/nextjs';
import { ProgramsHome } from './ProgramsHome';
import type { ProgramCardData } from './ProgramsHome';

const meta = {
  title: 'Modules/ProgramsHome',
  component: ProgramsHome,
  parameters: { layout: 'fullscreen' },
  args: {
    onNewProgram: () => {},
    onOpenProgram: () => {},
    onSignOut: () => {},
  },
} satisfies Meta<typeof ProgramsHome>;

export default meta;
type Story = StoryObj<typeof meta>;

const PROGRAMS: ProgramCardData[] = [
  {
    id: 'p1',
    title: 'Copywriting for Creators',
    status: 'published',
    coverStyle: 'gradient',
    seed: 0,
    moduleCount: 6,
    learnerCount: 42,
  },
  {
    id: 'p2',
    title: 'Ship Your First Newsletter',
    status: 'draft',
    coverStyle: 'geometric',
    seed: 1,
    moduleCount: 3,
    learnerCount: 0,
  },
  {
    id: 'p3',
    title: 'Cohort-Based Course Design',
    status: 'published',
    coverStyle: 'geometric',
    seed: 2,
    moduleCount: 8,
    learnerCount: 1,
  },
  {
    id: 'p4',
    title: 'Freelance Foundations',
    status: 'draft',
    coverStyle: 'gradient',
    seed: 2,
    moduleCount: 1,
    learnerCount: 0,
  },
];

/** No programs yet — the EmptyState with the "Create your first program" CTA. */
export const Empty: Story = {
  args: { programs: [] },
};

/** A grid of mixed draft/published programs. */
export const WithPrograms: Story = {
  args: { programs: PROGRAMS },
};

/** With an app-injected Cohorts slot (the real invite/approve/roster content). */
export const WithCohortsSlot: Story = {
  args: {
    programs: PROGRAMS,
    cohortsSlot: (
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--color-bg-surface)',
          padding: '32px 30px',
          color: 'var(--color-text-muted)',
          fontSize: 13,
        }}
      >
        [ app-injected enrollment / roster content renders here ]
      </div>
    ),
  },
};

/** With-programs grid on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  args: { programs: PROGRAMS },
};

/** Empty state on the light theme. */
export const EmptyLight: Story = {
  globals: { theme: 'light' },
  args: { programs: [] },
};
