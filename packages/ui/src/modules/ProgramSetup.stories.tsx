import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { ProgramSetup } from './ProgramSetup';
import type { ProgramSetupValue } from './ProgramSetup';

const meta = {
  title: 'Modules/ProgramSetup',
  component: ProgramSetup,
  parameters: { layout: 'fullscreen' },
  // Each story overrides `render` with a stateful harness; these default args
  // just satisfy the required-prop types.
  args: {
    value: { title: '' },
    onChange: () => {},
    onContinue: () => {},
  },
} satisfies Meta<typeof ProgramSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness({ initial }: { initial: ProgramSetupValue }) {
  const [value, setValue] = useState<ProgramSetupValue>(initial);
  return <ProgramSetup value={value} onChange={setValue} onContinue={() => {}} />;
}

/** Empty form — Continue is disabled until title + shape + visibility are set. */
export const Empty: Story = {
  render: () => <Harness initial={{ title: '' }} />,
};

/** Partially filled — everything but visibility, so Continue is still disabled. */
export const PartiallyFilled: Story = {
  render: () => <Harness initial={{ title: 'Copywriting for Creators', shape: 'cohort', coverStyle: 'geometric' }} />,
};

/** Fully valid — Continue is enabled. */
export const Filled: Story = {
  render: () => (
    <Harness
      initial={{ title: 'Copywriting for Creators', shape: 'self_paced', visibility: 'public', coverStyle: 'gradient' }}
    />
  ),
};

/** Fully valid on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  render: () => (
    <Harness
      initial={{ title: 'Copywriting for Creators', shape: 'workshop', visibility: 'private', coverStyle: 'geometric' }}
    />
  ),
};
