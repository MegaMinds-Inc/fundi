import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so any domain module can inject PrismaService without re-importing.
 * The client it exposes is org-scoped — see prisma.service.ts.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
