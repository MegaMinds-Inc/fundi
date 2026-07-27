// Root Prettier config for the whole monorepo. Re-exports the single shared
// config (`@fundi/config`) that the ESLint `prettier/prettier` rule also uses,
// so `prettier --write`, the pre-commit hook, and `pnpm turbo lint` all enforce
// the exact same formatting — no drift between "formatted" and "lint-passing".
export { default } from './packages/config/prettier.js';
