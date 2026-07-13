import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Tag } from './Tag';

const meta = {
  title: 'Components/Tag',
  component: Tag,
  argTypes: {
    color: { control: 'inline-radio', options: ['neutral', 'green', 'teal', 'amber', 'red'] },
    selected: { control: 'boolean' },
    removable: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: { children: 'Cohort A', color: 'green' },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Tag color="neutral">Neutral</Tag>
      <Tag color="green">Active</Tag>
      <Tag color="teal">Cohort</Tag>
      <Tag color="amber">Pending</Tag>
      <Tag color="red">Blocked</Tag>
    </div>
  ),
};

export const Selected: Story = { args: { selected: true } };

export const Removable: Story = { args: { removable: true } };

/** Single-select filter row — click to change the active tag. */
export const AsFilter: Story = {
  render: () => {
    const options = ['all', 'live', 'drafts', 'archived'];
    const [active, setActive] = useState('all');
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map((value) => (
          <Tag
            key={value}
            color="green"
            selected={active === value}
            onClick={() => setActive(value)}
          >
            {value}
          </Tag>
        ))}
      </div>
    );
  },
};
