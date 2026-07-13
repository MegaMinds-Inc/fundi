# ADR-ENG-0001: Storybook for `@fundi/ui` — component & module isolation and review

> Engineering/tooling ADR, scoped to this repo's development workflow — distinct numbering from
> the product-level ADR-001…ADR-013 in
> [`clickup-sync/product/technical-architecture-adr.md`](../clickup-sync/product/technical-architecture-adr.md).
> Follow-ups to this decision get their own `NNNN` file in this folder, referencing this one.

## Status

Accepted — implemented 2026-07-12. Storybook 10 (`@storybook/nextjs`) is wired into `packages/ui`
with `.storybook/` config (styles.css + `data-theme` dark/light toolbar global + Phosphor via
`preview-head.html`) and `src/components/*.stories.tsx` covering all 9 base components. The
`src/modules/*.stories.tsx` surface described below is established by convention and fills in as
the 21-module backlog is built (full-page assembly lives in the apps, not in Storybook — see
Decision). CI publishing is wired: a
`build-storybook` turbo task gates every PR (in `ci.yml`), and on a successful `CI` run on `main`
the `Deploy Storybook (Dev)` workflow triggers a Render static-site deploy (`fundi-storybook` in
`render.yaml`) — the same GitHub-source-of-truth / Render-API pattern as the API's `Deploy (Dev)`.
One-time setup: create the static site from the Blueprint in Render and add the
`RENDER_STORYBOOK_SERVICE_ID` secret to the `dev` GitHub Environment.

## Context

`packages/ui` currently has 9 base components (Button, Input, Card, Badge, Tag, Tabs, Modal,
Drawer, EmptyState) with **zero automated verification that they render correctly** beyond
`tsc --noEmit` and ESLint — there is no tool to actually see a component in isolation, exercise its
variants, or catch a visual regression. The two Next.js apps (`apps/creator`, `apps/learner`) are
the only place a component currently renders, which means:

- A design-system change can only be checked by wiring it into a real screen first.
- There's no shared surface for the team (or a designer) to review "does `Button` look right in
  all 4 variants × 3 sizes × disabled state" without hunting through app code.
- The design handoff (`Fundi Design System.zip`, extracted and audited — see
  [`../design-system/README.md`](../design-system/README.md)) ships each `ui_kit` as a **composed,
  mocked screen** (`index.html` per feature area, e.g. the Needs You queue, the AI draft review
  flow) that assembles several not-yet-built modules together with demo data. Those mockups are the
  **design reference for the real screens** — which get built in the apps (`apps/creator`,
  `apps/learner`) — and they show why the modules underneath them need an isolated place to be
  developed and reviewed before that app-level assembly happens.
- 21 composite/feature modules (ExceptionCard, DraftQueue, ProgramSetup, etc. — full catalog in
  `../design-system/README.md`) are queued up to be built, several composing 3-4 base components
  with real state machines (e.g. `AuthFlow`'s phone→OTP→success flow, `DraftEditor`'s
  approve/reject workflow). Building 21 modules with no isolated way to develop/preview them means
  every one gets debugged inside a real (currently placeholder) screen — slow, and it silently
  re-introduces exactly the tight coupling ADR-012 tried to avoid by splitting creator/learner into
  separate PWAs in the first place.

## Decision

Add **Storybook** to `packages/ui`, using `@storybook/nextjs` (not `@storybook/react-vite`) even
though `packages/ui` itself has no Next.js dependency — the *addon* targets the framework the
*stories* will eventually need to emulate (App Router conventions, `next/image`, etc. once
composite modules start assuming them), and both learner/creator apps are Next.js, so authoring
stories against the same primitives avoids a second, divergent bundler config down the line.

**Structure:**
- `packages/ui/.storybook/` — config (`main.ts`, `preview.tsx` importing `@fundi/ui/styles.css`
  and wiring the `data-theme` toggle as a Storybook global, matching the dark-default/light-toggle
  pattern already in `packages/ui/README.md`).
- `packages/ui/src/components/*.stories.tsx` — one file per base component, one story per
  variant/state combination called out in the design handoff (reuse the exact prop combinations
  the fidelity audit already verified — see `../design-system/README.md`).
- `packages/ui/src/modules/*.stories.tsx` — as each composite module gets built (see the module
  task backlog), its stories live alongside it. The backlog's 21 named modules are a floor, not a
  ceiling: freely extract further modules for any repeated on-page pattern — e.g. the single row a
  listing repeats (`LessonRow`, a roster row) is itself a module the listing module composes. Every
  module exports from its own file and is re-exported from the single `src/index.ts` barrel (the
  chosen strategy — no per-folder barrels, no subpath export map).
- **No `src/pages/` mock-page layer.** Full screens — assembling modules with routing, data
  fetching, auth, and the app shell — are built in the apps (`apps/creator`, `apps/learner`), *not*
  re-created as mock pages in `packages/ui`. Duplicating that assembly in both places is a
  maintenance trap and drags app-only concerns into the shared package (the coupling ADR-012 exists
  to avoid). A module story may still compose a few modules together to show them cooperating —
  that is a component demo, not a page. The handoff's `ui_kit/*/index.html` mockups are the
  reference for building those app screens. If one specific screen genuinely needs pre-app design
  sign-off, a single throwaway composition story is acceptable **by exception**, not as a standing
  mirror of every mockup.

**The boundary, stated plainly:** `components/` (primitives) and `modules/` (**any isolatable
composition** — a feature block, a repeated on-page pattern, or the single list *item* a listing
renders many of) live and are reviewed in `packages/ui`; **pages/screens** (a route's worth of
assembly + data + routing) live in `apps/creator` / `apps/learner`. A module does **not** have to be
shared across apps to belong here — extracting a named, isolatable composition is reason enough;
names may be generic (`ListRow`, `MessageComposer`) or contextual (`ExceptionCard`, `LessonRow`).
And presence in `packages/ui` is **not** the same as being bundled: an app bundles only the modules
it actually imports, so a creator-only module living here never weighs on the learner bundle.

**Conventions (as the tree grows):**
- **Stories co-locate** with the file they exercise — `Foo.tsx` and `Foo.stories.tsx` sit in the
  same folder (already the pattern for the 9 base components).
- **No per-folder barrel / `index.ts`.** Each component/module is a named export from its own file
  (`export function Foo` + `export interface FooProps`). The single package entry
  `packages/ui/src/index.ts` is the only aggregation point (it backs the `.` export the apps import
  from) — a new module adds one re-export line there, not a `modules/index.ts`.
- **Styling & responsiveness.** Tokens (CSS custom properties) are the styling foundation. Small,
  non-responsive presentation may stay in inline `style` objects, but **responsive layout,
  breakpoint variants, and interaction states (`:hover`/`:focus`) belong in a co-located
  `*.module.css`** — inline styles can't express `@media` or pseudo-classes. Breakpoints are the
  three `tokens/layout.css` tiers (tablet `768px`, desktop `1200px`), hardcoded in `@media`
  conditions (CSS vars are invalid there). When a module must render a genuinely *different subtree*
  per breakpoint (e.g. `CohortRoster`'s card list vs. dense table), use the SSR-safe
  `useBreakpoint()` hook; prefer CSS `@media` for pure restyling. CSS Modules work with the
  no-build/`transpilePackages` setup and `@storybook/nextjs` (proven). Existing inline-styled
  components migrate incrementally; new modules use CSS Modules from the start.

**Scripts** (added to `packages/ui/package.json`, following this repo's existing `pnpm --filter`
convention): `storybook` (dev server), `build-storybook` (static export). Wire `build-storybook`
into `turbo.json` as a `build`-adjacent task once the CI pipeline (already set up — see commit
history) is extended to publish it; not required for this ADR to land.

**Deployment for team review:** publish the static Storybook build wherever the rest of this
project's Render/Vercel setup already lives — check `packages/docs/features/` for the actual
CI/CD entries once the corresponding `features/000X-*.md` write-up exists (not yet reviewed as
part of this ADR; a static Storybook export is a plain static site, so it should slot into
whichever static-hosting path `apps/creator`/`apps/learner` already use, rather than needing new
infrastructure decisions).

## Consequences

### Positive
- Every base component and composite module gets a reviewable, isolated surface — no more "wire
  it into a real screen to see if it looks right."
- Clean separation of concerns: the reusable pieces (components + modules) live and are reviewed in
  `packages/ui`, while full-screen assembly + data + routing stays in the apps — one source of truth
  for each, with no duplicated screen mockups to keep in sync.
- Forces every new composite module to declare its props/API cleanly enough to be driven by
  Storybook controls — a natural pressure toward the same clean prop interfaces the fidelity audit
  found in the 9 existing base components.
- Catches visual/prop-contract regressions in `packages/ui` before they reach either app, one
  level earlier than the current `pnpm --filter creator/learner build` check.

### Negative
- New dev dependency surface in `packages/ui` (`@storybook/nextjs` and its addons) — adds install
  time and a new devDependency block to `packages/config`-adjacent tooling to keep in sync with
  the rest of the monorepo's shared `eslint`/`typescript` version pins.
- No whole-screen preview inside Storybook before the app route exists — modules are reviewed in
  isolation, and the assembled screen is seen by running the app (or, by exception, a one-off
  composition story). Accepted trade-off for not duplicating screen assembly across `packages/ui`
  and the apps.
- One more thing to keep green in CI once wired in (`build-storybook` failing on a broken story).

### Neutral
- `packages/ui` remains framework-light (no `next` runtime dependency) even though Storybook uses
  the Next.js addon — the addon only affects the dev/build tooling, not `packages/ui`'s own
  `dependencies`.
- This ADR only covers `packages/ui`. If `apps/creator`/`apps/learner` ever grow app-specific
  components not meant for reuse, whether those get their own Storybook instance or stay
  undocumented is a separate decision, not addressed here.
