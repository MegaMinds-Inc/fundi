# @fundi/api

NestJS modular monolith. See ADR-002, ADR-006, ADR-011.

## Development

```
pnpm --filter api dev         # ts-node + node --watch, http://localhost:3000
pnpm --filter api build       # tsc build
pnpm --filter api lint        # eslint (includes barrel-only import check)
pnpm --filter api boundaries  # dependency-cruiser: module boundary + SDK isolation check
```

Dev runs on `ts-node` (not `tsx`) — `tsx`'s esbuild transpiler does not implement
`emitDecoratorMetadata`, which breaks NestJS constructor dependency injection silently.

## Health check

`GET /health` -> `{ "status": "ok", "timestamp": "<ISO8601>" }`

## Module boundaries

Each domain module (`src/modules/<name>`) exposes exactly one public surface: its `index.ts`
barrel. Do not import a module's internal files (`*.service.ts`, `*.controller.ts`, interfaces)
from outside that module's own folder — import the module class (and any exported interface
types) from the barrel only.

This is enforced two ways:
- `pnpm --filter api lint` — ESLint `import-x/no-restricted-paths` (resolves imports to their
  actual file path, so it also catches deep relative imports), fast, local check.
- `pnpm --filter api boundaries` — `dependency-cruiser`, authoritative, graph-based check. See
  `.dependency-cruiser.cjs`.

`messaging` and `ai` are the only modules permitted to import an external WhatsApp/Meta SDK or LLM
provider SDK, respectively (ADR-011 §1). This is enforced by `.dependency-cruiser.cjs` — the SDK
name patterns there are best-guesses since no real SDK is installed yet; review and tighten once
the real SDK choice is made.
