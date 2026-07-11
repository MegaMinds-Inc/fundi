# @fundi/ui

Shared design-system package for the Fundi Creator and Learner PWAs (`apps/creator`,
`apps/learner`), consumed via `workspace:*`. Ships as raw TypeScript/TSX source (`src/index.ts` is
both `main` and `types`) — no build step; consuming Next.js apps transpile it directly as part of
their own bundling. See `packages/docs/features/0001-sprint-0-foundation.md` and (once landed) the
Task 7 entry for the reasoning behind this no-build approach.

`react`/`react-dom` are `peerDependencies`, not `dependencies` — this package does not bundle its
own React copy; the consuming app provides it.

## Lint

Currently on `@fundi/config/eslint/base` (not `.../eslint/next` — that variant requires a real
`next` dependency to resolve its parser, which this package intentionally does not have). This
means no React-hooks-specific lint rules (`react-hooks/rules-of-hooks`,
`react-hooks/exhaustive-deps`) are currently enforced here. Revisit once this package has a
component that actually uses hooks — add `eslint-plugin-react-hooks` to a new
`@fundi/config/eslint/react-lib` variant at that point.

## Components

- `Badge` — minimal labeled pill, `{ label: string }`.
