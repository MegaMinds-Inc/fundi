# 0005 — Design system: tokens + core component set (Sprint 1, US-001 & US-002)

**Covers:** porting the "Pulse" design-system handoff bundle into `packages/ui` as a real
TypeScript/TSX workspace package — the token layer (US-001) and the 9-component core set (US-002) —
and wiring both PWAs (`apps/creator`, `apps/learner`) to consume it. Sprint 1's US-003
(`packages/config` shared lint/tsconfig/prettier) was already delivered in Sprint 0
([`0001`](./0001-sprint-0-foundation.md)).

## What was built

### Tokens (US-001) — `packages/ui/src/tokens/` + `styles.css`

The 8 token files from the handoff, copied verbatim (they are the source of truth): `colors.css`
(dark default + `[data-theme="light"]` override), `typography.css` (Sora / Manrope / JetBrains
Mono type scale), `spacing.css`, `radius.css`, `shadow.css`, `layout.css` (mobile-first 3-tier
breakpoints + 12-col fluid grid), `fonts.css` (Google Fonts import), `base.css` (reset + link
defaults). `styles.css` `@import`s them in order and is the single stylesheet an app loads.

- **Light + dark** both defined; dark is the default surface (unset `data-theme`), light via
  `<html data-theme="light">` — same semantic aliases, no component-layer branching.
- **Mobile-first**: token values are the small-screen base; `layout.css` documents the breakpoints
  as the canonical numbers to hardcode into `@media` queries (CSS vars aren't valid in media
  conditions).
- Exposed via the package `exports` map: `@fundi/ui/styles.css` and `@fundi/ui/tokens/*`.

### Components (US-002) — `packages/ui/src/components/`

All 9 from the confirmed inventory: **Button, Input, Card, Badge, Tag, Tabs, Modal, Drawer,
EmptyState**. Each was converted from the handoff's plain-script React (attached to
`window.FundiDesignSystem_*`, `module.exports`) into a proper ESM `.tsx` with its `.d.ts` prop
contract inlined as an exported interface, re-exported from `src/index.ts`.

- Components style themselves entirely through `var(--…)` token references (inline styles) — load
  `styles.css` once and everything renders on-brand; no per-component CSS import.
- Interactive components carry `'use client'`; the two purely-presentational ones (`Badge`,
  `EmptyState`) omit it so they can render in Server Components too.
- `Tabs` measures its active tab to animate the indicator — uses a small
  `useIsomorphicLayoutEffect` helper (`useLayoutEffect` in the browser, `useEffect` on the server)
  to avoid the SSR warning.
- `Tabs` gained a typed `variant` prop (`pill` / `underline` / `boxed`) that the handoff impl
  supported but its `.d.ts` omitted; `Input` gained `type` / `inputMode` / `name` for phone/OTP
  entry (needed by the Identity & Auth stories next).

### App consumption (`apps/creator`, `apps/learner`)

- Both `next.config.ts` now list `transpilePackages: ['@fundi/ui', '@fundi/types']` — the workspace
  packages ship raw TS/TSX with no build step, so Next transpiles them.
- Both root layouts `import '@fundi/ui/styles.css'` and load Phosphor Icons (the substituted icon
  set) via CDN `<link>`.
- **Creator runs the default dark theme; Learner runs light** (`data-theme="light"`) — exercising
  both themes across the two apps from day one.
- Demo pages rewritten onto the real components (the old placeholder `<Badge label=…>` API is gone;
  Badge is now tone-coded with children).

## Why

Sprint 1's screen-level stories (Needs You queue, Enrollment, Learner Progress, AI Draft Review,
Auth Flow) all reference these components directly — US-002 is a hard prerequisite, not a
nice-to-have. Porting the handoff into a token-driven, theme-agnostic package now means every later
screen is built from shared primitives that stay in sync across both PWAs, dark and light.

## Decisions / deviations

- **Inline-style + CSS-variable tokens kept as-is** (not migrated to CSS Modules / Tailwind). The
  handoff components already read tokens via `var(--…)`, which is theme-agnostic and portable; a
  rewrite would risk drift from the delivered visual direction for no functional gain.
- **No standalone typecheck for `@fundi/ui`.** Its own `tsconfig` inherits `nodenext` resolution
  (which would demand `.js` import extensions and lacks the DOM lib), but the package ships as
  source and is typechecked *by the consuming apps* via Next (bundler resolution + DOM lib) — the
  same no-build pattern established for it in Sprint 0. `build`/`test` remain no-ops; `lint`
  (eslint base) is the local gate.
- **`Modal` / `Drawer` position `absolute`** within the nearest positioned ancestor, per the
  handoff — screens wrap them in a positioned shell. Documented in the component README.
- **Icons via Phosphor CDN** — carried over from the handoff's substitution; swap if the team
  standardizes on another set.

## How to verify

- `pnpm turbo build` — both PWAs compile and statically prerender pages built from the components.
- `pnpm turbo lint` / `pnpm turbo test` — green across the monorepo.
- Token shipping (not just compiling): the production CSS chunk of each app contains
  `--color-accent-primary`, the Google-Fonts `@import`, and the `[data-theme=light]` override.
- Bundle isolation intact (ADR-012): the creator-only marker string is absent from
  `apps/learner/.next` — the shared package didn't leak creator-only code into the learner bundle.
- Visual: `pnpm --filter creator dev` (dark, :3001) and `pnpm --filter learner dev` (light, :3002).
