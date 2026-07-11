# @fundi/api

NestJS modular monolith. See ADR-002, ADR-006, ADR-011.

## Development

```
pnpm --filter api dev     # tsx watch, http://localhost:3000
pnpm --filter api build   # tsc build
pnpm --filter api lint    # eslint (includes barrel-only import check)
```

## Health check

`GET /health` -> `{ "status": "ok", "timestamp": "<ISO8601>" }`

## Module boundaries

Each domain module (`src/modules/<name>`) exposes exactly one public surface: its `index.ts`
barrel. Do not import a module's internal files (`*.service.ts`, `*.controller.ts`, interfaces)
from outside that module's own folder — import the module class (and any exported interface
types) from the barrel only.

This is enforced by `pnpm --filter api lint` (ESLint `no-restricted-imports`, fast, local check).

`messaging` and `ai` are the only modules permitted to import an external WhatsApp/Meta SDK or LLM
provider SDK, respectively (ADR-011 §1).
