import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    iconOnly: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    children: 'Continue',
    variant: 'primary',
    size: 'md',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Ghost: Story = { args: { variant: 'ghost', children: 'Learn more' } };

export const Danger: Story = { args: { variant: 'danger', children: 'Remove learner' } };

export const Disabled: Story = { args: { disabled: true } };

export const WithIcon: Story = {
  args: {
    children: 'New program',
    icon: <i className="ph ph-plus" />,
  },
};

export const IconOnly: Story = {
  args: {
    iconOnly: true,
    'aria-label': 'Add',
    icon: <i className="ph ph-plus" />,
  },
};

/** All three sizes side by side. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};
