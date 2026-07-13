import type { StorybookConfig } from '@storybook/nextjs';

/**
 * Storybook for @fundi/ui — see ADR-ENG-0001
 * (packages/docs/architecture/0001-storybook-for-design-system-workflow.md).
 *
 * Uses the Next.js framework addon even though @fundi/ui has no Next runtime
 * dependency: both consuming apps are Next, so stories are authored against the
 * same bundler/JSX pipeline the components will actually run under.
 */
const config: StorybookConfig = {
  // Base components today; src/modules/*.stories.tsx and src/pages/*.stories.tsx
  // (composed-page previews) land here as the 21-module backlog gets built.
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
};

export default config;
