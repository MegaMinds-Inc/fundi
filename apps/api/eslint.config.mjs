import nestjsConfig from '@fundi/config/eslint/nestjs';
import importXPlugin from 'eslint-plugin-import-x';

const domainModules = ['programs', 'enrollment', 'scheduling', 'messaging', 'ai', 'payments'];

const nonModulePaths = ['./src/main.ts', './src/app.module.ts', './src/health'];

// Cheap, lint-time first line of defense for ADR-002's barrel-only import
// rule — TypeScript itself cannot enforce this (barrels are a convention,
// not a language feature). The authoritative, graph-based check is
// dependency-cruiser (see .dependency-cruiser.cjs, Sprint 0 Task 4).
//
// Uses import-x/no-restricted-paths (resolves imports to their actual file
// path) rather than ESLint core's no-restricted-imports (which only matches
// the raw import specifier string and would miss violations written as
// relative paths, e.g. `../programs/programs.service`).
const zones = domainModules.map((mod) => ({
  target: [
    ...nonModulePaths,
    ...domainModules.filter((m) => m !== mod).map((m) => `./src/modules/${m}`),
  ],
  from: `./src/modules/${mod}`,
  except: ['./index.ts'],
  message: `Import only from modules/${mod}'s barrel (index.ts) — internals are private. See ADR-002.`,
}));

export default [
  ...nestjsConfig,
  {
    plugins: { 'import-x': importXPlugin },
    settings: {
      'import-x/resolver': {
        typescript: true,
      },
    },
    rules: {
      'import-x/no-restricted-paths': ['error', { zones }],
    },
  },
];
