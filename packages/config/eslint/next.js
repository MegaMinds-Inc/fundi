import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import baseConfig from './base.js';

export default [
  ...baseConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react's auto React-version-detection calls an ESLint
    // Linter API (context.getFilename()) that no longer exists in ESLint 10's
    // flat-config runtime, crashing with "contextOrFilename.getFilename is
    // not a function". Setting an explicit version skips that code path.
    settings: {
      react: {
        version: '19.2.7',
      },
    },
  },
];
