# @fundi/ui

Shared design-system package for the Fundi Creator and Learner PWAs (`apps/creator`,
`apps/learner`), consumed via `workspace:*`. Ships as raw TypeScript/TSX source (`src/index.ts` is
both `main` and `types`) — no build step; consuming Next.js apps transpile it directly (they list
`@fundi/ui` in `transpilePackages`). See `packages/docs/features/0001-sprint-0-foundation.md` and
`0005-*` (design system) for the reasoning.

`react`/`react-dom` are `peerDependencies`, not `dependencies` — this package does not bundle its
own React copy; the consuming app provides it.

## Theme: "Pulse"

Dark is the **default** surface (leave `data-theme` unset). Light is available via
`<html data-theme="light">` (or on any scoped container) and swaps the same semantic tokens —
nothing in the component layer branches on theme. Every component styles itself purely through the
CSS custom properties in `styles.css`.

## Consuming it

Import the token stylesheet **once** per app, in the root layout (it's global CSS):

```tsx
// apps/<app>/app/layout.tsx
import '@fundi/ui/styles.css';
```

Then use components anywhere:

```tsx
import { Button, Card, Badge } from '@fundi/ui';
```

Individual token files are also exported if needed: `@fundi/ui/tokens/colors.css`, etc.

### Icons

Components that render an icon (`EmptyState`, and any `icon`/`iconLeft` slot you fill) expect
**Phosphor Icons** (the substituted set — see design-system-foundations doc). Load the font in the
app if you use icon-bearing components:

```tsx
// in <head> — e.g. next/script or a <link>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2/src/regular/style.css" />
```

## Tokens (`src/tokens/`, US-001)

`colors` (dark default + `[data-theme="light"]`), `typography` (Sora / Manrope / JetBrains Mono),
`spacing`, `radius`, `shadow`, `layout` (mobile-first 3-tier breakpoints + 12-col grid), `fonts`
(Google Fonts import), `base` (reset + link defaults). `styles.css` imports them in order. Always
build UI against the **semantic** aliases (`--color-bg-surface`, `--color-accent-primary`, …),
not the raw `--base-*` values.

Mobile-first: token values are the small-screen base. `layout.css` documents the breakpoints
(`--breakpoint-tablet: 768px`, `--breakpoint-desktop: 1200px`) as the canonical numbers to hardcode
into `@media` queries (CSS variables aren't valid inside media conditions).

## Components (`src/components/`, US-002)

All are inline-styled and read tokens via `var(--…)`. Interactive ones carry `'use client'`; the
two purely-presentational ones (`Badge`, `EmptyState`) do not, so they can render in Server
Components too.

| Component | Notes |
| --- | --- |
| `Button` | `primary` / `secondary` / `ghost` / `danger`; `sm` / `md` / `lg`; `iconOnly` circular mode (requires `aria-label`). |
| `Input` | label, `iconLeft` / `iconRight` slots, circular `actionIcon` send button, `error` / `helperText`. `type`/`inputMode` for phone/OTP entry. |
| `Card` | optional 16:9 `media` slot, `title` + `meta` header, `footer`, `interactive` hover-lift. |
| `Badge` | status pill, tone-coded `live` / `draft` / `warn` / `danger` / `neutral`. |
| `Tag` | curated color set, `selected`, `removable`. |
| `Tabs` | `pill` / `underline` / `boxed`, animated sliding indicator. |
| `Modal` | scrim + centered dialog, `title`, `footer`. Accessible: `role="dialog"`, focus trap, Escape-to-close, focus restore. |
| `Drawer` | mobile-first bottom action sheet; scrollable body + sticky footer. Same dialog a11y as `Modal`; `inert` while closed. |
| `EmptyState` | icon circle + heading + body; `primary` / `neutral` tone. |

`Modal` and `Drawer` position `absolute` within the nearest positioned ancestor (per the design
handoff) — wrap them in a full-viewport `position: relative` container for a page-level overlay.

Both share `src/lib/useDialogA11y.ts` (focus trap, Escape, focus move-in/restore) — the composite
modules that wrap `Drawer` (ActionSheet, DraftEditor, HelpCapture) inherit this for free. Their
close controls are real `<button>`s and each dialog is labelled by its `title` via `aria-labelledby`.

## Responsive & styling

Tokens (CSS custom properties) are the styling foundation. Small, non-responsive presentation is
inline-styled; **responsive layout, breakpoint variants, and `:hover`/`:focus` states use a
co-located `*.module.css`** (real `@media` + pseudo-classes, which inline styles can't express). The
three tiers match `tokens/layout.css` — tablet `768px`, desktop `1200px` — hardcoded in `@media`
(CSS variables aren't valid inside media conditions).

For a module that renders a genuinely different subtree per breakpoint (e.g. `CohortRoster`'s card
list vs. dense table), use the SSR-safe `useBreakpoint()` hook; prefer CSS `@media` for pure
restyling. Existing inline-styled components migrate to CSS Modules incrementally; new modules use
them from the start.

## Storybook

Every base component has stories in `src/components/*.stories.tsx` — one per variant/state, with
Controls for the enum/boolean props. Run the explorer:

```bash
pnpm --filter @fundi/ui storybook        # dev server on :6006
pnpm --filter @fundi/ui build-storybook  # static export to storybook-static/
```

A toolbar **Theme** control switches the Pulse dark/light themes (dark is the default, applied via
`data-theme` on the story wrapper). `Modal`/`Drawer` stories render inside a positioned stage since
those overlays position `absolute`. Phosphor is loaded via `.storybook/preview-head.html`, mirroring
the apps. As the composite-module backlog lands, module stories co-locate in
`src/modules/*.stories.tsx`. **Full pages/screens are built in the apps** (`apps/creator`,
`apps/learner`), not as mock pages here — `packages/ui` owns reusable components and modules only.
Rationale, structure, and the boundary:
`packages/docs/architecture/0001-storybook-for-design-system-workflow.md`.

## Lint

On `@fundi/config/eslint/base` (not `.../eslint/next` — that variant layers on Next-specific rules
meant for the apps). `@fundi/ui` ships no Next.js **runtime** dependency; `next` is present only as
a Storybook-only devDependency (the `@storybook/nextjs` framework needs it). React-hooks lint rules
are therefore not enforced here yet — revisit by adding an `@fundi/config/eslint/react-lib` variant
with `eslint-plugin-react-hooks` if hook misuse becomes a risk.
