export { PrismaModule } from './prisma.module';
export { PrismaService } from './prisma.service';
export type { OrgScopedPrismaClient } from './prisma.service';
export { runWithOrgContext, getOrgContext, MissingOrgContextError } from './org-context';
export type { OrgContext } from './org-context';
export { applyOrgScope, TENANT_SCOPED_MODELS } from './org-scope';
export { scopeOperation } from './scope-operation';
