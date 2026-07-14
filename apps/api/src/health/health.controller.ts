import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth';

// Health is an infra endpoint (Render `healthCheckPath: /health`) and must
// answer without a token — the global AuthGuard would otherwise 401 it.
// `@Public()` exempts it from the guard; it is also excluded from the /api/v1
// prefix in main.ts so the probe stays at /health.
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
