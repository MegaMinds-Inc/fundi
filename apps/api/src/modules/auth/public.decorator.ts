import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a route handler (or controller) as unauthenticated. */
export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Mark a route as public so the global {@link AuthGuard} lets it through with
 * no access token, and the global org-context interceptor binds no context.
 * The five pre-auth `/auth/*` endpoints use this — without it, login would
 * deadlock (you'd need a token to obtain a token).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
