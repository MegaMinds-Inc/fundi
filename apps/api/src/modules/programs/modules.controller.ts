import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import type {
  CreateLessonRequest,
  LessonDetail,
  ModuleDetail,
  MoveRequest,
  UpdateModuleRequest,
} from '@fundi/types';
import { LessonType, ModuleUnlockMode } from '@prisma/client';
import { ProgramsService } from './programs.service';
import {
  optionalString,
  requireEnum,
  requireNonEmpty,
  requirePositiveInt,
} from './programs.validation';

const UNLOCK_MODES = new Set<string>(Object.values(ModuleUnlockMode));
const LESSON_TYPES = new Set<string>(Object.values(LessonType));
const DIRECTIONS = new Set<string>(['up', 'down']);

/**
 * Module-scoped routes (`/modules/:id/...`). Kept a separate controller from
 * ProgramsController because the URL prefix differs; both share ProgramsService
 * and the same validators. Module CREATE lives on ProgramsController
 * (`POST /programs/:id/modules`, nested under its parent).
 */
@Controller('modules')
export class ModulesController {
  constructor(private readonly programs: ProgramsService) {}

  /** `PATCH /modules/:id` — autosave module settings (any subset). */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<UpdateModuleRequest>,
  ): Promise<ModuleDetail> {
    const input: UpdateModuleRequest = {};
    if (body?.title !== undefined) input.title = requireNonEmpty(body.title, 'title');
    if (body?.description !== undefined)
      input.description = optionalString(body.description, 'description') ?? null;
    if (body?.unlockMode !== undefined)
      input.unlockMode = requireEnum(body.unlockMode, UNLOCK_MODES, 'unlockMode');
    if (body?.unlockDays !== undefined)
      input.unlockDays =
        body.unlockDays === null ? null : requirePositiveInt(body.unlockDays, 'unlockDays');
    return this.programs.updateModule(id, input);
  }

  /** `DELETE /modules/:id` — cascades to its lessons. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.programs.deleteModule(id);
  }

  /** `POST /modules/:id/move` — swap `order` with the adjacent sibling. */
  @Post(':id/move')
  @HttpCode(HttpStatus.NO_CONTENT)
  move(@Param('id') id: string, @Body() body: Partial<MoveRequest>): Promise<void> {
    const direction = requireEnum<'up' | 'down'>(body?.direction, DIRECTIONS, 'direction');
    return this.programs.moveModule(id, direction);
  }

  /** `POST /modules/:id/lessons` — append a lesson to the module. */
  @Post(':id/lessons')
  createLesson(
    @Param('id') id: string,
    @Body() body: Partial<CreateLessonRequest>,
  ): Promise<LessonDetail> {
    return this.programs.createLesson(id, {
      title: requireNonEmpty(body?.title, 'title'),
      type: requireEnum(body?.type, LESSON_TYPES, 'type'),
    });
  }
}
