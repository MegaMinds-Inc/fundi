import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma';
import { ProgramsModule } from './modules/programs';
import { EnrollmentModule } from './modules/enrollment';
import { SchedulingModule } from './modules/scheduling';
import { MessagingModule } from './modules/messaging';
import { AiModule } from './modules/ai';
import { PaymentsModule } from './modules/payments';
import { HealthModule } from './health';

@Module({
  imports: [
    PrismaModule,
    ProgramsModule,
    EnrollmentModule,
    SchedulingModule,
    MessagingModule,
    AiModule,
    PaymentsModule,
    HealthModule,
  ],
})
export class AppModule {}
