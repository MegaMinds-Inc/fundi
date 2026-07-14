import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from './token.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest } from './principal.decorator';
import { ACCESS_COOKIE_NAME, ACCESS_COOKIE_NAME_HOST } from './auth.constants';

/**
 * Global guard that turns the org-scope engine "on" for real requests. It
 * verifies the access JWT and attaches `req.principal`, which the
 * {@link OrgContextInterceptor} then binds org context from. `@Public()` routes
 * (the pre-auth `/auth/*` endpoints) bypass it — without that, login deadlocks.
 *
 * The token is read from `Authorization: Bearer` first (how the BFF calls the
 * API server-to-server), falling back to the `fundi_at` cookie so a direct
 * cookie-bearing request also authenticates.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({ code: 'no_token', message: 'Authentication required.' });
    }
    request.principal = this.tokens.verifyAccessToken(token);
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    const cookies = (request as { cookies?: Record<string, string> }).cookies;
    return cookies?.[ACCESS_COOKIE_NAME_HOST] ?? cookies?.[ACCESS_COOKIE_NAME];
  }
}
