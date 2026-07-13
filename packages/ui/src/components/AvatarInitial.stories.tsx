import type { Meta, StoryObj } from '@storybook/nextjs';
import { AvatarInitial } from './AvatarInitial';

const meta = {
  title: 'Components/AvatarInitial',
  component: AvatarInitial,
  argTypes: {
    tone: { control: 'inline-radio', options: ['primary', 'teal', 'neutral'] },
    size: { control: { type: 'number', min: 24, max: 72 } },
  },
  args: { name: 'Ama Mensah', size: 40, tone: 'primary' },
} satisfies Meta<typeof AvatarInitial>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One word, two words, many words, and an empty name (→ "?"). */
export const Names: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <AvatarInitial name="Ama" />
      <AvatarInitial name="Ama Mensah" tone="teal" />
      <AvatarInitial name="kofi owusu boateng" tone="neutral" />
      <AvatarInitial name="" tone="neutral" />
    </div>
  ),
};
