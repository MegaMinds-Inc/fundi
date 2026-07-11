import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettierConfig,
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**', 'coverage/**', '.turbo/**'],
  },
];
