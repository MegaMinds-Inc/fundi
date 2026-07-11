import baseConfig from './base.js';

export default [
  ...baseConfig,
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
    },
  },
];
