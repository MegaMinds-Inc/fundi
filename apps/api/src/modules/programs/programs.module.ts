import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ModulesController } from './modules.controller';
import { LessonsController } from './lessons.controller';
import { ProgramsService } from './programs.service';

@Module({
  controllers: [ProgramsController, ModulesController, LessonsController],
  providers: [ProgramsService],
  // Exported so EnrollmentModule can inject ProgramsService via Nest DI
  // (the barrel-only boundary rule permits this: the *class* is exported
  // through the barrel, unlike a direct cross-module file import).
  exports: [ProgramsService],
})
export class ProgramsModule {}
