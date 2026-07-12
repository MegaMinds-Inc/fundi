import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Browser PWAs (creator/learner) call this API cross-origin. In prod, set
  // CORS_ORIGINS to a comma-separated allowlist; in dev (unset) allow all.
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? true });
  const port = process.env.PORT ?? 3000;
  // Bind all interfaces explicitly — required by container hosts like Render.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[api] listening on port ${port}`);
}

bootstrap();
