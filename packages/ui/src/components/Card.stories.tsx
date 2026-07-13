import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from './Button';
import { Badge } from './Badge';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  argTypes: {
    interactive: { control: 'boolean' },
  },
  args: {
    title: 'Intro to Mobile Money',
    meta: '6 modules',
    children: 'A short program covering the basics of mobile money for new agents.',
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}>{Story()}</div>],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFooter: Story = {
  args: {
    footer: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge tone="live">Live</Badge>
        <Button variant="ghost">Open</Button>
      </div>
    ),
  },
};

export const WithMedia: Story = {
  args: {
    media: (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-text-faint)',
        }}
      >
        <i className="ph ph-image" style={{ fontSize: 32 }} />
      </div>
    ),
  },
};

/** Hover to see the lift + deeper shadow. */
export const Interactive: Story = {
  args: { interactive: true },
};
