# 0007 — Frontends on Vercel: GitHub-driven CI/CD + server-only runtime env

**Covers:** hosting the two PWAs (`apps/creator`, `apps/learner`) on **Vercel**, with
**GitHub-driven** deploys (mirroring the backend), and a **server-only env policy** — no
`NEXT_PUBLIC_` variables, every env value server-side and injected at runtime. The backend stays
on Render + Supabase (see `0006`).

This is deliberately **not** a rendering change: `page.tsx`, the design-system showcase, and the
SSR-vs-client question are untouched here — that's a separate discussion. This delivers the
hosting + the env discipline only.

## The env policy (the point of this change)

**No `NEXT_PUBLIC_*`.** Anything prefixed `NEXT_PUBLIC_` is inlined into the browser bundle at
build time — forbidden. All Fundi env is server-side and read from `process.env` in a server
context (server component, route handler, server action) at runtime. Nothing config- or
secret-shaped ever reaches client JavaScript.

Enforced structurally by a `no-restricted-syntax` ESLint rule in
`packages/config/eslint/next.js` that fails the build on any `NEXT_PUBLIC_` identifier or string —
so the policy can't silently erode. Both PWAs inherit it via `@fundi/config/eslint/next`.

When an app first needs an env value, read it server-side only; add the sanctioned accessor then
(not seeded speculatively now). `.env.example` in each app documents the convention; local values
go in gitignored `.env.local`.

## What was built
- **ESLint guard** — `packages/config/eslint/next.js`: bans `NEXT_PUBLIC_` (identifier + literal).
- **`apps/<app>/.env.example`** — documents server-side runtime-only env; seeded with
  `API_BASE_URL` (the Render API URL) as the example first var (no consumer wired yet).
- **`apps/<app>/vercel.json`** — minimal `{ "framework": "nextjs" }`.
- **`.github/workflows/deploy-frontend-dev.yml`** — GitHub-driven Vercel deploy:
  - **Production**: after `CI` succeeds on `main`, matrix over both apps → push `API_BASE_URL`
    into the Vercel project as a **production runtime** var from the GitHub value, then
    `vercel pull/build/deploy --prod`.
  - **Preview**: on same-repo PRs (forks skipped — no secret access), deploy a preview per app and
    comment the URLs on the PR (replaces Vercel's native auto-preview, off because GitHub drives
    deploys).

## Env & secrets (extends the GitHub `dev` Environment from `0006`)
| Name | Notes |
|---|---|
| `API_BASE_URL` | Render API URL — server-side runtime var (example; not consumed yet) |
| `VERCEL_TOKEN` | Vercel access token (secret) |
| `VERCEL_ORG_ID` | Vercel team/org id |
| `VERCEL_PROJECT_ID_CREATOR` / `_LEARNER` | the two Vercel project ids |

All applied to Vercel as **runtime** env (production + preview targets). Never `NEXT_PUBLIC_`.

## One-time setup
1. **Vercel**: create two projects (`fundi-creator`, `fundi-learner`) from the repo; set each
   project's **Root Directory** to `apps/creator` / `apps/learner`; **disable "Automatically
   deploy from Git"** (this workflow drives deploys). Create a token (Account Settings → Tokens);
   note the org id and both project ids.
2. **GitHub → Settings → Environments → `dev`**: add the five values above.
3. Branch protection on `main` already requires the CI `verify` check (from `0006`).

## How a change flows
1. PR → **CI** gate runs (lint incl. the NEXT_PUBLIC guard, test, build) + the **Preview** job
   comments two Vercel preview URLs.
2. Merge to `main` → CI passes → **Production** job pushes runtime env to Vercel and deploys both
   apps.

## Verification
1. **Policy enforced**: add a throwaway `process.env.NEXT_PUBLIC_FOO` reference to a creator file
   → `pnpm --filter creator lint` fails with the guard message; remove it → green.
2. **CI gate** unaffected: `pnpm turbo lint test build` green (18/18).
3. **Bundle isolation** holds: `FUNDI_CREATOR_ONLY_BUILDER_PANEL_MARKER` absent from
   `apps/learner/.next` (pages untouched).
4. **Vercel** (after setup): PR shows two preview URLs; merge to `main` deploys both to
   production; a `grep -r NEXT_PUBLIC apps/*/.next/static` finds nothing.

## Follow-ups (not done here)
- `turbo-ignore` to skip deploying an app whose code/deps didn't change (kept out for now to avoid
  base-SHA fragility — both apps deploy on each `main` merge).
- Backend CORS can be removed once frontends call the API server-to-server (BFF), since the
  browser no longer hits the API cross-origin.
- The sanctioned server-side env accessor + the actual API-consumption/rendering pattern — the
  deferred "rendering" discussion.
