import { Controller, Get } from '@nestjs/common';
import type { ProgramSummary } from '@fundi/types';
import { ProgramsService } from './programs.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  list(): Promise<ProgramSummary[]> {
    return this.programsService.listPrograms();
  }
}
