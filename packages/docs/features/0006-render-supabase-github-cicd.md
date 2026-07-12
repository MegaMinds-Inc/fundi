# 0006 — Dev deploy: Render + Supabase, driven by GitHub CI/CD

**Covers:** hosting `apps/api` on **Render** (free) with Postgres on **Supabase**, with all
deployment env/secrets managed from **GitHub** and injected at deploy time. Delivers the
Release-0 roadmap items *"Dev environment … connected to CI"* and *"CI/CD: lint/test/build →
auto-deploy to Dev on merge"*, and satisfies Sprint-1 US-003's *"CI blocks merge on failure"*.
Redis/Upstash is still deferred (no BullMQ code yet).

## The model in one line

**GitHub is the source of truth for env/secrets.** A CI gate blocks merges; on merge to `main`
a deploy workflow migrates Supabase and pushes the runtime env to Render via the Render API,
then triggers the deploy. Nothing secret is committed — the Supabase DB URLs (which contain the
DB password) live only as encrypted GitHub Environment secrets.

## What was built

### App/deploy changes (working tree)
- `apps/api/prisma/schema.prisma` — `directUrl` (runtime = transaction pooler; migrations =
  session pooler). Render is IPv4-only, so both URLs use Supabase's IPv4 Supavisor pooler host.
- `apps/api/package.json` — `"start": "node dist/main.js"`.
- `apps/api/src/main.ts` — `enableCors(CORS_ORIGINS)` + `listen(port, '0.0.0.0')`.
- `apps/api/.env.example` — documents `DIRECT_URL`, `CORS_ORIGINS`.
- `render.yaml` — Blueprint for the `fundi-api` web service (free, `frankfurt`, health `/health`).
  `autoDeploy: false` (deploys are CI-driven via the Render API); build = install + `tsc`;
  migrations run in CI, **not** in the Render build; the three env vars are `sync: false`
  (pushed by CI) and `NODE_VERSION` is a committed non-secret.

### Pipelines
- `.github/workflows/ci.yml` — runs on every PR and on push to `main`. No secrets (safe on fork
  PRs). Spins up a **Postgres 16 service** and applies migrations to it so the org-scoping
  integration test runs for real, then `pnpm turbo lint test build` + `pnpm --filter @fundi/api
  boundaries`. This is the merge gate.
- `.github/workflows/deploy-dev.yml` — triggered via `workflow_run` only when **CI succeeds on
  `main`**; bound to the `dev` GitHub Environment. Steps: install → `prisma migrate deploy`
  against Supabase → PUT the full env set to the Render API → POST a deploy. Deploys the exact
  commit that passed CI (`workflow_run.head_sha`).

## One-time setup (do this once, then it's automatic)

### Supabase
1. Create the project; save the DB password.
2. **Connect** → copy two IPv4 pooler strings (host `…pooler.supabase.com`):
   - **Transaction** (`:6543`) → `DATABASE_URL`, append `?pgbouncer=true&connection_limit=1`.
   - **Session** (`:5432`) → `DIRECT_URL`.
   Keep the Render service region matched to the Supabase region (see `render.yaml` comment).

### Render
1. **New → Blueprint**, point at `MegaMinds-Inc/fundi` → Render reads `render.yaml` and creates
   `fundi-api`. (It won't auto-deploy — `autoDeploy: false`.)
2. Copy the service id (`srv-…`) from the service URL/settings.
3. **Account Settings → API Keys** → create a key.

### GitHub
1. **Settings → Environments → New environment: `dev`.** Add secrets:
   | Secret | Source |
   |---|---|
   | `DATABASE_URL` | Supabase transaction pooler (`:6543`, `?pgbouncer=true&connection_limit=1`) |
   | `DIRECT_URL` | Supabase session pooler (`:5432`) |
   | `CORS_ORIGINS` | comma-separated PWA origins, e.g. `https://creator.…,https://learn.…` |
   | `RENDER_API_KEY` | the Render API key |
   | `RENDER_SERVICE_ID` | the `srv-…` id |
2. **Settings → Branches → protect `main`**: require the CI `verify` check to pass before merge
   (this is what makes the gate binding — GitHub Actions files can't set branch protection).

## How a change flows
1. Open a PR → **CI** runs lint/test/build + the org-isolation test against a throwaway Postgres.
   A red check blocks merge.
2. Merge to `main` → CI runs again on `main`; on success, **Deploy (Dev)** fires.
3. Deploy migrates Supabase, pushes env to Render, triggers the deploy. Render builds
   (`install → tsc`) and starts (`node dist/main.js`).

## Rotating a secret
Update it in the GitHub `dev` Environment and re-run the latest **Deploy (Dev)** (or push a
commit). The `env-vars` PUT replaces Render's full set from GitHub, so the new value propagates —
GitHub stays authoritative.

## Trade-offs / notes
- **Why the Render API sync:** the app *runs on* Render, so the container needs its own env copy.
  Pushing it from GitHub on each deploy is what keeps GitHub the single source of truth. Simpler
  fallback (not chosen): set the runtime secrets once in Render and let CI only gate + migrate —
  then GitHub isn't authoritative for runtime env.
- **Fork-PR safety:** deploy secrets live only in the `dev` Environment, reachable only by the
  `deploy` job (push/`main`, environment-gated). CI on PRs never sees them.
- **Migrations** auto-run on every Dev deploy; `migrate deploy` is non-destructive by default.
  Add a required reviewer on the `dev` Environment to gate deploys once there's real data.
- **Free-tier:** Render spins down after ~15 min idle (~50s cold start); Supabase pauses after
  ~7 days idle. Fine for Dev.
- **Extends to staging/prod** by adding `staging`/`production` GitHub Environments (AWS per
  ADR-007) — out of scope now.

## Verification
1. **Gate:** open a PR that breaks a test → CI fails → merge blocked. Fix → green → mergeable.
2. **Deploy:** merge to `main` → Deploy (Dev) migrates Supabase, syncs env, triggers Render.
3. `curl https://fundi-api.onrender.com/health` → `{"status":"ok",…}`; Render log shows
   `Connected to Postgres`; Supabase shows the `organisations`, `programs`, … tables.
4. **Source-of-truth:** change `CORS_ORIGINS` in the GitHub `dev` Environment, re-run Deploy →
   the new value appears on the Render service (pushed via API).
