import type { Meta, StoryObj } from '@storybook/nextjs';
import { ProgressBar } from './ProgressBar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  argTypes: {
    percent: { control: { type: 'range', min: 0, max: 100 } },
    tone: { control: 'inline-radio', options: ['primary', 'teal'] },
  },
  args: { percent: 40, tone: 'primary' },
  decorators: [(Story) => <div style={{ width: 280 }}>{Story()}</div>],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { percent: 0 } };
export const Complete: Story = { args: { percent: 100 } };
