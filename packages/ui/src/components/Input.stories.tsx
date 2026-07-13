import type { Meta, StoryObj } from '@storybook/nextjs';
import { Input } from './Input';

const meta = {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    type: { control: 'text' },
    inputMode: {
      control: 'inline-radio',
      options: ['text', 'tel', 'numeric', 'email', 'search'],
    },
    disabled: { control: 'boolean' },
  },
  args: {
    label: 'Full name',
    placeholder: 'Ama Mensah',
  },
  decorators: [(Story) => <div style={{ maxWidth: 360 }}>{Story()}</div>],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHelperText: Story = {
  args: { helperText: 'This is how learners will see you.' },
};

export const WithLeadingIcon: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search programs',
    iconLeft: <i className="ph ph-magnifying-glass" />,
  },
};

/** Phone-number entry with the circular submit action — the Sprint 1 OTP-request shape. */
export const PhoneWithAction: Story = {
  args: {
    label: 'Phone number',
    placeholder: '+233 20 000 0000',
    type: 'tel',
    inputMode: 'tel',
    iconLeft: <i className="ph ph-phone" />,
    actionIcon: <i className="ph ph-arrow-right" />,
  },
};

export const Error: Story = {
  args: {
    label: 'Phone number',
    placeholder: '+233 20 000 0000',
    type: 'tel',
    error: 'Enter a valid phone number.',
  },
};

export const Disabled: Story = {
  args: { placeholder: 'Ama Mensah', disabled: true },
};
