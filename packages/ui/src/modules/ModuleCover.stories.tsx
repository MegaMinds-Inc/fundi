import type { Meta, StoryObj } from '@storybook/nextjs';
import { ModuleCover } from './ModuleCover';

const meta = {
  title: 'Modules/ModuleCover',
  component: ModuleCover,
  args: {
    coverStyle: 'gradient',
    seed: 0,
    height: 104,
  },
  decorators: [(Story) => <div style={{ width: 260, margin: '0 auto' }}>{Story()}</div>],
} satisfies Meta<typeof ModuleCover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Gradient generator, seed 0. */
export const Gradient: Story = {};

/** Geometric generator, seed 0. */
export const Geometric: Story = { args: { coverStyle: 'geometric' } };

/** The three deterministic seed variations of the gradient generator side by side. */
export const GradientSeeds: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {[0, 1, 2].map((s) => (
        <ModuleCover key={s} coverStyle="gradient" seed={s} height={104} />
      ))}
    </div>
  ),
};

/** The three deterministic seed variations of the geometric generator. */
export const GeometricSeeds: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {[0, 1, 2].map((s) => (
        <ModuleCover key={s} coverStyle="geometric" seed={s} height={104} />
      ))}
    </div>
  ),
};

/** Same covers on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      <ModuleCover coverStyle="gradient" seed={0} height={104} />
      <ModuleCover coverStyle="geometric" seed={1} height={104} />
    </div>
  ),
};
