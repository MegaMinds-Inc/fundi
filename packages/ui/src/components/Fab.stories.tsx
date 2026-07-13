import type { Meta, StoryObj } from '@storybook/nextjs';
import { Fab } from './Fab';

const meta = {
  title: 'Components/Fab',
  component: Fab,
  argTypes: {
    tone: { control: 'inline-radio', options: ['teal', 'primary'] },
    icon: { control: 'text' },
  },
  args: { icon: 'ph-hand-waving', ariaLabel: 'Ask for help', tone: 'teal' },
} satisfies Meta<typeof Fab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fixed to the bottom-right of the preview frame (as it would sit over a screen). */
export const Default: Story = {};
