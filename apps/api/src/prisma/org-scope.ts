/**
 * Pure org-scoping logic, kept separate from the Prisma client so it can be
 * unit-tested without a database or a generated client (see org-scope.test.ts).
 *
 * `applyOrgScope` takes the args Prisma is about to run and returns a copy with
 * the org filter injected — into `where` for reads/filtered writes, and into
 * `data` for creates. The extension in prisma.service.ts wires this into every
 * query against a tenant-scoped model.
 */

/**
 * The models that carry `organisation_id` and MUST be org-scoped. Mirrors the
 * tenant-scoped tables in prisma/schema.prisma. `Organisation` is deliberately
 * absent — it is the tenant root, not a tenant-scoped row.
 *
 * Keep this in sync with the schema: a tenant-scoped model missing here would
 * silently run unscoped, which is exactly the leak ADR-008 forbids. The
 * completeness test in org-scope.test.ts guards against drift.
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  'Mentor',
  'Program',
  'Module',
  'Lesson',
  'Cohort',
  'Learner',
  'Enrollment',
  'Progress',
  'Assessment',
  'Signal',
  'Channel',
  'MessageTemplate',
  'Message',
  'DripJob',
]);

/** Operations whose `where` clause must be constrained to the org. */
const WHERE_SCOPED_OPS = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/** Operations that create rows and must stamp `organisationId` into the data. */
const CREATE_OPS = new Set<string>(['create', 'createMany', 'createManyAndReturn']);

type AnyArgs = Record<string, unknown> | undefined;

function scopeWhere(args: AnyArgs, organisationId: string): Record<string, unknown> {
  const where = (args?.where as Record<string, unknown> | undefined) ?? {};
  return { ...args, where: { ...where, organisationId } };
}

function stampData(data: unknown, organisationId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => ({ organisationId, ...(row as Record<string, unknown>) }));
  }
  // Caller-supplied organisationId is preserved if present, but the extension
  // never lets it differ from context — see prisma.service.ts guard.
  return { organisationId, ...(data as Record<string, unknown>) };
}

/**
 * Return a scoped copy of `args` for `model.operation`, injecting
 * `organisationId`. Non-tenant models and unknown operations are returned
 * unchanged (the extension only calls this for tenant-scoped models).
 */
export function applyOrgScope(params: {
  model: string;
  operation: string;
  args: AnyArgs;
  organisationId: string;
}): AnyArgs {
  const { operation, args, organisationId } = params;

  if (operation === 'upsert') {
    const scoped = scopeWhere(args, organisationId);
    scoped.create = stampData(args?.create ?? {}, organisationId);
    return scoped;
  }

  if (WHERE_SCOPED_OPS.has(operation)) {
    return scopeWhere(args, organisationId);
  }

  if (CREATE_OPS.has(operation)) {
    return { ...args, data: stampData(args?.data ?? {}, organisationId) };
  }

  // Operations with neither a where nor data to scope (e.g. none currently) —
  // pass through untouched rather than guessing.
  return args;
}
