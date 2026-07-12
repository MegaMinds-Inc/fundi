# ADR-ENG-0001: Storybook for `@fundi/ui` — component isolation, review, and composed-page previews

> Engineering/tooling ADR, scoped to this repo's development workflow — distinct numbering from
> the product-level ADR-001…ADR-013 in
> [`clickup-sync/product/technical-architecture-adr.md`](../clickup-sync/product/technical-architecture-adr.md).
> Follow-ups to this decision get their own `NNNN` file in this folder, referencing this one.

## Status

Proposed

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
  flow) that assembles several not-yet-built modules together with demo data — exactly the kind of
  artifact a component-explorer tool is built to reproduce and keep interactive, but currently has
  no home in this codebase.
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
- `packages/ui/src/modules/*.stories.tsx` — as each of the 21 composite modules gets built (see
  the module task backlog), its stories live alongside it.
- `packages/ui/src/pages/*.stories.tsx` — **composed-page stories**: the direct answer to "mocked
  pages like the design handoff." Each `ui_kit` folder's `index.html` (Needs You queue, AI draft
  review, program builder, etc.) becomes one Storybook story that assembles the real built modules
  with the same demo data the handoff used — reviewable by the team before a real Next.js route
  exists for it, exactly mirroring what the design handoff already demonstrates, but with real
  components instead of static HTML.

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
- The design handoff's composed `ui_kit` mockups get a direct, living equivalent (`pages/*.stories.tsx`)
  built from real code instead of static HTML — the team always has an up-to-date "what does the
  Needs You queue look like" reference, without needing a real backend or a finished screen.
- Forces every new composite module to declare its props/API cleanly enough to be driven by
  Storybook controls — a natural pressure toward the same clean prop interfaces the fidelity audit
  found in the 9 existing base components.
- Catches visual/prop-contract regressions in `packages/ui` before they reach either app, one
  level earlier than the current `pnpm --filter creator/learner build` check.

### Negative
- New dev dependency surface in `packages/ui` (`@storybook/nextjs` and its addons) — adds install
  time and a new devDependency block to `packages/config`-adjacent tooling to keep in sync with
  the rest of the monorepo's shared `eslint`/`typescript` version pins.
- Composed-page stories (`pages/*.stories.tsx`) require real modules to exist first — they can't
  fully replace the design handoff's mockups until the 21-module backlog (see
  `../design-system/README.md`) is substantially built. In the interim, composed-page stories can
  only be written for feature areas whose modules are done.
- One more thing to keep green in CI once wired in (`build-storybook` failing on a broken story).

### Neutral
- `packages/ui` remains framework-light (no `next` runtime dependency) even though Storybook uses
  the Next.js addon — the addon only affects the dev/build tooling, not `packages/ui`'s own
  `dependencies`.
- This ADR only covers `packages/ui`. If `apps/creator`/`apps/learner` ever grow app-specific
  components not meant for reuse, whether those get their own Storybook instance or stay
  undocumented is a separate decision, not addressed here.
