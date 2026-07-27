import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { PhoneInput } from './PhoneInput';

const meta = {
  title: 'Modules/PhoneInput',
  component: PhoneInput,
  argTypes: {
    label: { control: 'text' },
    error: { control: 'text' },
    disabled: { control: 'boolean' },
    regionCode: { control: 'text' },
    dialCode: { control: 'text' },
  },
  args: {
    value: '',
    onChange: () => {},
  },
  decorators: [(Story) => <div style={{ width: 360, margin: '0 auto' }}>{Story()}</div>],
} satisfies Meta<typeof PhoneInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled({
  start = '',
  ...args
}: { start?: string } & Partial<ComponentProps<typeof PhoneInput>>) {
  const [value, setValue] = useState(start);
  return <PhoneInput {...args} value={value} onChange={setValue} />;
}

/** Type a local number — digits group as "080 123 4567" as you go (formatting only). */
export const Default: Story = {
  render: (args) => <Controlled {...args} />,
};

export const Prefilled: Story = {
  render: (args) => <Controlled {...args} start="0801234567" />,
};

export const WithHelper: Story = {
  args: { helperText: "We'll text you a code — no password to remember." },
  render: (args) => <Controlled {...args} />,
};

export const Error: Story = {
  args: { error: 'Enter a valid phone number, e.g. 0803 123 4567.' },
  render: (args) => <Controlled {...args} start="080" />,
};

/** A different region context — only the leading affordance changes. */
export const NigeriaRegion: Story = {
  args: { regionCode: 'NG', dialCode: '+234' },
  render: (args) => <Controlled {...args} start="08031234567" />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Controlled {...args} start="0801234567" />,
};
