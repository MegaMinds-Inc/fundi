import baseConfig from '@fundi/config/eslint/base';

export default [
  ...baseConfig,
  {
    // @fundi/ui is browser UI code — allow the DOM globals its components use
    // (focus management, keyboard handling, etc.). The base config only declares
    // Node globals.
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDivElement: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
      },
    },
  },
  {
    // Storybook static export — build artifact, never linted.
    ignores: ['storybook-static/**'],
  },
];
