import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // All application routes are served under a versioned prefix — the BFF calls
  // `${API_BASE_URL}/api/v1/...`. `health` is excluded so infra probes hit
  // `/health` unversioned (render.yaml healthCheckPath). Bump the version here
  // and in the BFF's apiUrl() together when the contract changes.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  // Parse the BFF's httpOnly auth cookies (fundi_at / fundi_rt) so the auth
  // guard can read a token from a cookie when no Bearer header is present.
  app.use(cookieParser());
  // Browser PWAs (creator/learner) call this API cross-origin. In prod, set
  // CORS_ORIGINS to a comma-separated allowlist; in dev (unset) allow all.
  // credentials:true so the BFF (server-side) may forward cookies if it uses them.
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? true, credentials: true });
  const port = process.env.PORT ?? 3000;
  // Bind all interfaces explicitly — required by container hosts like Render.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[api] listening on port ${port}`);
}

bootstrap();
