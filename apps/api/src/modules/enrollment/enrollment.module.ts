import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ProgramsModule } from '../programs';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';

@Module({
  // AuthModule (for PhoneService) and ProgramsModule (for ProgramsService) are
  // imported so EnrollmentService can inject them via Nest DI, going only
  // through each module's barrel — never a direct cross-module file import
  // (enforced by the ESLint no-restricted-paths rule + dependency-cruiser).
  imports: [AuthModule, ProgramsModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
