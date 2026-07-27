import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type {
  CreateModuleRequest,
  CreateProgramRequest,
  ModuleDetail,
  Principal,
  ProgramCreated,
  ProgramDetail,
  ProgramSummary,
  UpdateProgramRequest,
} from '@fundi/types';
// Runtime enum VALUES come from @prisma/client (CJS-safe); @fundi/types is
// type-only here (its ESM source can't be `require`d under ts-node — the same
// reason auth.service imports MentorRole/AppClient from @prisma/client).
import { ProgramCoverStyle, ProgramShape, ProgramVisibility } from '@prisma/client';
import { CurrentPrincipal } from '../auth';
import { ProgramsService } from './programs.service';
import { optionalString, requireEnum, requireNonEmpty } from './programs.validation';

const SHAPES = new Set<string>(Object.values(ProgramShape));
const VISIBILITIES = new Set<string>(Object.values(ProgramVisibility));
const COVER_STYLES = new Set<string>(Object.values(ProgramCoverStyle));

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  list(): Promise<ProgramSummary[]> {
    return this.programsService.listPrograms();
  }

  @Post()
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: Partial<CreateProgramRequest>,
  ): Promise<ProgramCreated> {
    const input: CreateProgramRequest = {
      title: requireNonEmpty(body?.title, 'title'),
      shape: requireEnum(body?.shape, SHAPES, 'shape'),
      visibility: requireEnum(body?.visibility, VISIBILITIES, 'visibility'),
      description: optionalString(body?.description, 'description'),
      coverStyle:
        body?.coverStyle === undefined
          ? undefined
          : requireEnum(body.coverStyle, COVER_STYLES, 'coverStyle'),
    };
    return this.programsService.createProgram(principal, input);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<ProgramDetail> {
    return this.programsService.getProgramDetail(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<UpdateProgramRequest>,
  ): Promise<ProgramDetail> {
    const input: UpdateProgramRequest = {};
    if (body?.title !== undefined) input.title = requireNonEmpty(body.title, 'title');
    if (body?.description !== undefined)
      input.description = optionalString(body.description, 'description') ?? '';
    if (body?.shape !== undefined) input.shape = requireEnum(body.shape, SHAPES, 'shape');
    if (body?.visibility !== undefined)
      input.visibility = requireEnum(body.visibility, VISIBILITIES, 'visibility');
    if (body?.coverStyle !== undefined)
      input.coverStyle = requireEnum(body.coverStyle, COVER_STYLES, 'coverStyle');
    return this.programsService.updateProgram(id, input);
  }

  /**
   * `POST /programs/:id/publish` — validate + take the program live. `400
   * program_not_publishable` if no visible module has a lesson; `404` cross-org.
   */
  @Post(':id/publish')
  publish(@Param('id') id: string): Promise<ProgramDetail> {
    return this.programsService.publishProgram(id);
  }

  /**
   * `POST /programs/:id/unpublish` — return the program to draft (keeps
   * `publishedAt`). Idempotent; `404` cross-org.
   */
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string): Promise<ProgramDetail> {
    return this.programsService.unpublishProgram(id);
  }

  /** `POST /programs/:id/modules` — append a module to the program. */
  @Post(':id/modules')
  createModule(
    @Param('id') id: string,
    @Body() body: Partial<CreateModuleRequest>,
  ): Promise<ModuleDetail> {
    return this.programsService.createModule(id, {
      title: requireNonEmpty(body?.title, 'title'),
    });
  }
}
