import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, Observable } from 'rxjs';
import { runWithOrgContext } from '../../prisma';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest } from './principal.decorator';

/**
 * Global interceptor that binds the request's org context from the
 * authenticated principal — the missing link that wires the ADR-008 engine to
 * real HTTP requests (Multi-tenancy US-002).
 *
 * The `from(runWithOrgContext(... lastValueFrom(next.handle())))` shape is
 * deliberate: `runWithOrgContext` internally `await`s its callback, so the
 * lazy Prisma queries dispatched by the controller/service downstream run while
 * the AsyncLocalStorage zone is still active (see org-context.ts). Bridging the
 * rxjs pipeline to a promise with `lastValueFrom` and back with `from` keeps
 * that zone alive across the whole handler.
 *
 * Public routes bind nothing. An authenticated but org-less token (onboarding)
 * also binds nothing: if such a request reaches a tenant-scoped query, the
 * engine throws `MissingOrgContextError` — a loud fail the exception filter maps
 * to `403`, never a silent unscoped `200`.
 */
@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const org = request.principal?.org;
    if (!org) {
      // Org-less (onboarding) token: bind nothing. A tenant query downstream
      // will fail loudly rather than run unscoped.
      return next.handle();
    }

    return from(runWithOrgContext({ organisationId: org }, () => lastValueFrom(next.handle())));
  }
}
