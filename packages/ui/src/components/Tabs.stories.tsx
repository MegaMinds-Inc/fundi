import type { Meta, StoryObj } from '@storybook/nextjs';
import { Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  argTypes: {
    variant: { control: 'inline-radio', options: ['pill', 'underline', 'boxed'] },
  },
  args: {
    variant: 'pill',
    tabs: [
      { label: 'All', value: 'all' },
      { label: 'Live', value: 'live' },
      { label: 'Drafts', value: 'drafts' },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default segmented-pill tabs with the animated indicator. */
export const Pill: Story = {};

export const Underline: Story = { args: { variant: 'underline' } };

export const Boxed: Story = { args: { variant: 'boxed' } };
