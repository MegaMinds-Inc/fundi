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
    rules: {
      // Fundi env policy: NO client-exposed env. `NEXT_PUBLIC_` vars are inlined
      // into the browser bundle at build — forbidden. All env must be server-side
      // and read from process.env at runtime only. See packages/docs/features/0007.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Identifier[name=/^NEXT_PUBLIC_/]',
          message:
            'NEXT_PUBLIC_* env vars are forbidden — Fundi env must stay server-side (read process.env in a server context only). See packages/docs/features/0007.',
        },
        {
          selector: 'Literal[value=/^NEXT_PUBLIC_/]',
          message:
            'NEXT_PUBLIC_* env vars are forbidden — Fundi env must stay server-side (read process.env in a server context only). See packages/docs/features/0007.',
        },
      ],
    },
  },
];
