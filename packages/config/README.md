# @fundi/config

Shared ESLint (flat config), TypeScript base, and Prettier config for the Fundi monorepo. Extended
via `workspace:*` by every `apps/*` and `packages/*` package — never referenced by relative path
(ADR-013).

## Usage

**ESLint** (`eslint.config.mjs`):
```js
import nestjsConfig from '@fundi/config/eslint/nestjs'; // or ./eslint/next, ./eslint/base
export default [...nestjsConfig];
```

**TypeScript** (`tsconfig.json`):
```json
{ "extends": "@fundi/config/tsconfig.base.json" }
```

**Prettier** (`prettier.config.js`):
```js
export { default } from '@fundi/config/prettier';
```
