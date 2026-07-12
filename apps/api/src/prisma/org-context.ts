import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The per-request tenant context. Carried implicitly through the async call
 * stack (via AsyncLocalStorage) so the Prisma extension can read it at query
 * time without every service threading `organisationId` through by hand.
 *
 * ADR-008: org scoping is enforced at the query layer, not left to individual
 * query authors to remember.
 */
export interface OrgContext {
  organisationId: string;
}

const storage = new AsyncLocalStorage<OrgContext>();

/**
 * Run `fn` (and everything it awaits) with the given org context bound. A
 * NestJS interceptor/guard establishes this once per request from the
 * authenticated principal; tests call it directly.
 */
export function runWithOrgContext<T>(context: OrgContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The current org context, or `undefined` if none is bound. */
export function getOrgContext(): OrgContext | undefined {
  return storage.getStore();
}

/**
 * Thrown when a tenant-scoped query runs with no org context bound. Failing
 * loudly here is the whole point: the alternative — running unscoped — is a
 * silent cross-tenant data leak (ADR-008, Negative consequence).
 */
export class MissingOrgContextError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Refusing to run ${model}.${operation}() with no organisation context. ` +
        `Wrap the call in runWithOrgContext({ organisationId }, ...) — a tenant-scoped ` +
        `query must never run unscoped (ADR-008).`,
    );
    this.name = 'MissingOrgContextError';
  }
}
