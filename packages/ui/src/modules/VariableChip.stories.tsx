import type { Meta, StoryObj } from '@storybook/nextjs';
import { VariableChip } from './VariableChip';

const meta = {
  title: 'Modules/VariableChip',
  component: VariableChip,
  args: { name: 'first_name', value: 'Ama' },
} satisfies Meta<typeof VariableChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Row: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <VariableChip name="first_name" value="Ama" />
      <VariableChip name="lesson" value="Mobile Money 3" />
      <VariableChip name="due" value="Friday" />
    </div>
  ),
};
