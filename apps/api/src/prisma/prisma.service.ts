import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopeOperation } from './scope-operation';

/**
 * Wrap a base PrismaClient in the org-scoping query extension. For every
 * operation on a tenant-scoped model, `scopeOperation`:
 *   1. throws if no org context is bound (never runs unscoped), and
 *   2. injects the current org's id into the query's where/data.
 *
 * Non-tenant models (only `Organisation` today) pass straight through.
 */
function withOrgScope(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = scopeOperation(model, operation, args as Record<string, unknown>);
          // The extension injects organisationId at runtime; the static arg
          // type can't express that, so we assert it back to `query`'s input.
          return query(scoped as typeof args);
        },
      },
    },
  });
}

export type OrgScopedPrismaClient = ReturnType<typeof withOrgScope>;

/**
 * Inject this and use `prisma.client` for all data access — it is the
 * org-scoped client (ADR-008). Every domain module goes through it; there is
 * no unscoped client exposed to product code.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly base = new PrismaClient();

  /** The org-scoped Prisma client. */
  readonly client: OrgScopedPrismaClient = withOrgScope(this.base);

  async onModuleInit(): Promise<void> {
    await this.base.$connect();
    this.logger.log('Connected to Postgres');
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }
}
