import type { Decorator, Preview } from '@storybook/nextjs';
import '../src/styles.css';

/**
 * Wraps every story in the Pulse canvas and applies the theme. Dark is the
 * product default (no `data-theme`); light is the `[data-theme="light"]`
 * override — matching the dark-default / light-toggle contract in
 * packages/ui/README.md. `data-theme` is set on the wrapper (not the document)
 * so the CSS custom properties cascade to the story and its descendants.
 */
const withTheme: Decorator = (Story, context) => {
  const light = context.globals.theme === 'light';
  return (
    <div
      data-theme={light ? 'light' : undefined}
      style={{
        background: 'var(--color-bg-canvas)',
        color: 'var(--color-text-body)',
        fontFamily: 'var(--font-body)',
        minHeight: '100vh',
        padding: 32,
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  initialGlobals: { theme: 'dark' },
  globalTypes: {
    theme: {
      description: 'Pulse theme (dark is the product default)',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'dark', title: 'Dark (default)' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [withTheme],
};

export default preview;
