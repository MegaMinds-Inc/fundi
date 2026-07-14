import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { Principal } from '@fundi/types';

/**
 * The authenticated principal attached to the request by {@link AuthGuard}.
 * Present on every non-`@Public()` route; absent on public ones.
 */
export interface AuthenticatedRequest extends Request {
  principal?: Principal;
}

/**
 * Inject the authenticated {@link Principal} into a controller method. Throws
 * if none is bound (the route was reached without the guard populating it — a
 * wiring bug, never a silent `undefined`).
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal) {
      throw new UnauthorizedException('No authenticated principal on request.');
    }
    return request.principal;
  },
);
