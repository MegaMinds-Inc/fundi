import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import type { LessonDetail, MoveRequest, UpdateLessonRequest } from '@fundi/types';
import { LessonType } from '@prisma/client';
import { ProgramsService } from './programs.service';
import { requireEnum, requireNonEmpty } from './programs.validation';

const LESSON_TYPES = new Set<string>(Object.values(LessonType));
const DIRECTIONS = new Set<string>(['up', 'down']);

/**
 * Lesson-scoped routes (`/lessons/:id/...`). Lesson CREATE lives on
 * ModulesController (`POST /modules/:id/lessons`, nested under its parent).
 */
@Controller('lessons')
export class LessonsController {
  constructor(private readonly programs: ProgramsService) {}

  /**
   * `PATCH /lessons/:id` — autosave a lesson (any subset). `content` is stored
   * verbatim as JSONB; its shape is a client concern (the type-switch discard
   * is handled client-side), so it is passed through without deep validation.
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<UpdateLessonRequest>,
  ): Promise<LessonDetail> {
    const input: UpdateLessonRequest = {};
    if (body?.title !== undefined) input.title = requireNonEmpty(body.title, 'title');
    if (body?.type !== undefined) input.type = requireEnum(body.type, LESSON_TYPES, 'type');
    // `content` is intentionally accepted as-is — presence of the key (even
    // `null`) means "set it"; absence means "leave unchanged". The service
    // keys off `'content' in input` for the same reason.
    if (body && 'content' in body) input.content = body.content;
    return this.programs.updateLesson(id, input);
  }

  /** `DELETE /lessons/:id`. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.programs.deleteLesson(id);
  }

  /** `POST /lessons/:id/move` — swap `order` with the adjacent sibling. */
  @Post(':id/move')
  @HttpCode(HttpStatus.NO_CONTENT)
  move(@Param('id') id: string, @Body() body: Partial<MoveRequest>): Promise<void> {
    const direction = requireEnum<'up' | 'down'>(body?.direction, DIRECTIONS, 'direction');
    return this.programs.moveLesson(id, direction);
  }
}
