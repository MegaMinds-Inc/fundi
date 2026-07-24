import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { PinInput } from './PinInput';

const meta = {
  title: 'Modules/PinInput',
  component: PinInput,
  argTypes: {
    length: { control: { type: 'number', min: 6, max: 8 } },
    error: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    length: 6,
    // Overridden by each story's local state below; here to satisfy the
    // required-prop types.
    value: '',
    onChange: () => {},
  },
} satisfies Meta<typeof PinInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({
  start = '',
  ...args
}: { start?: string } & Partial<ComponentProps<typeof PinInput>>) {
  const [value, setValue] = useState(start);
  return <PinInput {...args} value={value} onChange={setValue} />;
}

/**
 * Masked, numeric, `autoComplete="off"` — a chosen secret, never an SMS-autofill
 * target. Type digits: boxes render as dots, focus auto-advances, Backspace
 * steps back.
 */
export const Default: Story = {
  render: (args) => <Controlled {...args} />,
};

/** Same masked field on the learner light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  render: (args) => <Controlled {...args} />,
};

export const PartiallyFilled: Story = {
  render: (args) => <Controlled {...args} start="135" />,
};

export const Error: Story = {
  args: { error: true },
  render: (args) => <Controlled {...args} start="1357" />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Controlled {...args} start="13" />,
};
