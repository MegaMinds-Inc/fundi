import type { Meta, StoryObj } from '@storybook/nextjs';
import { PublishBar } from './PublishBar';

const meta = {
  title: 'Modules/PublishBar',
  component: PublishBar,
  args: {
    program: { title: 'Copywriting that converts', status: 'draft' },
    hasUnpublishedChanges: false,
    saveStatus: null,
    onPreview: () => {},
    onPublish: () => {},
    onExit: () => {},
  },
} satisfies Meta<typeof PublishBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Never-published draft — `Draft` badge, primary "Publish". */
export const Draft: Story = {};

/** Published with no pending edits — `Published` (live) badge, disabled "Up to date". */
export const PublishedClean: Story = {
  args: {
    program: { title: 'Copywriting that converts', status: 'published' },
    hasUnpublishedChanges: false,
  },
};

/** Published but edited since — `Unpublished changes` (warn) badge, active "Publish changes". */
export const PublishedWithChanges: Story = {
  args: {
    program: { title: 'Copywriting that converts', status: 'published' },
    hasUnpublishedChanges: true,
  },
};

/** Autosave in flight — the "Saving…" indicator under the title. */
export const Saving: Story = {
  args: {
    program: { title: 'Copywriting that converts', status: 'draft' },
    saveStatus: 'saving',
  },
};

/** Autosave settled. */
export const Saved: Story = {
  args: {
    program: { title: 'Copywriting that converts', status: 'draft' },
    saveStatus: 'saved',
  },
};

/** Draft state on the light theme. */
export const Light: Story = {
  globals: { theme: 'light' },
  args: {
    program: { title: 'Copywriting that converts', status: 'published' },
    hasUnpublishedChanges: true,
    saveStatus: 'saved',
  },
};
