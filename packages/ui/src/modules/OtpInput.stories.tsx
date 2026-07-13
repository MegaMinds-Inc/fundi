import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { OtpInput } from './OtpInput';

const meta = {
  title: 'Modules/OtpInput',
  component: OtpInput,
  argTypes: {
    length: { control: { type: 'number', min: 4, max: 8 } },
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
} satisfies Meta<typeof OtpInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({
  start = '',
  ...args
}: { start?: string } & Partial<ComponentProps<typeof OtpInput>>) {
  const [value, setValue] = useState(start);
  return <OtpInput {...args} value={value} onChange={setValue} />;
}

/** Type digits — focus auto-advances; Backspace steps back; paste fills all. */
export const Default: Story = {
  render: (args) => <Controlled {...args} />,
};

export const PartiallyFilled: Story = {
  render: (args) => <Controlled {...args} start="123" />,
};

export const Error: Story = {
  args: { error: true },
  render: (args) => <Controlled {...args} start="1234" />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Controlled {...args} start="12" />,
};
