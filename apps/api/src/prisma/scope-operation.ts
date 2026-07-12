import { getOrgContext, MissingOrgContextError } from './org-context';
import { applyOrgScope, TENANT_SCOPED_MODELS } from './org-scope';

/**
 * The decision the Prisma client extension makes for a single operation,
 * extracted so it can be unit-tested without a database or a generated client
 * (see org-scope.test.ts). The extension in prisma.service.ts is a thin wrapper
 * around this.
 *
 * - Non-tenant models: args returned unchanged.
 * - Tenant models with no org context bound: throws (never runs unscoped).
 * - Tenant models with context: args returned with the org filter injected.
 */
export function scopeOperation(
  model: string,
  operation: string,
  args: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!TENANT_SCOPED_MODELS.has(model)) {
    return args;
  }
  const context = getOrgContext();
  if (!context) {
    throw new MissingOrgContextError(model, operation);
  }
  return applyOrgScope({ model, operation, args, organisationId: context.organisationId });
}
