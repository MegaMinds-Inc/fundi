import { Controller, Get } from '@nestjs/common';
import { ProgramsService } from './programs.service';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  list(): string[] {
    return this.programsService.listPrograms();
  }
}
