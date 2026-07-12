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
 *
 * Deliberately `async` and internally `await`s `fn()` (rather than just
 * returning `storage.run(context, fn)` synchronously): Prisma's query
 * methods return a *lazy* thenable that doesn't actually dispatch the query
 * until awaited. If the await happened outside `storage.run()` (i.e. in the
 * caller, after this function had already returned), AsyncLocalStorage's
 * context would already be popped by the time the query — and this
 * extension's `$allOperations` check — actually runs, causing every scoped
 * call to spuriously throw `MissingOrgContextError` even when correctly
 * wrapped. Awaiting `fn()` here keeps the query's dispatch a continuation of
 * the still-active `run()` zone.
 */
export async function runWithOrgContext<T>(
  context: OrgContext,
  fn: () => T | PromiseLike<T>,
): Promise<T> {
  return storage.run(context, async () => fn());
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
