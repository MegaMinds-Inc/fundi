import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { EnrollmentSummary, InviteLearnerRequest, RosterResponse } from '@fundi/types';
import { EnrollmentService } from './enrollment.service';

@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Post('invite')
  @HttpCode(200)
  invite(@Body() body: Partial<InviteLearnerRequest>): Promise<EnrollmentSummary> {
    const programId = this.requireString(body?.programId, 'programId');
    const phone = this.requireString(body?.phone, 'phone');
    const cohortId = body?.cohortId ?? null;
    return this.enrollment.invite(programId, cohortId, phone, body?.name);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Param('id') id: string): Promise<EnrollmentSummary> {
    return this.enrollment.approve(id);
  }

  @Post(':id/decline')
  @HttpCode(204)
  decline(@Param('id') id: string): Promise<void> {
    return this.enrollment.decline(id);
  }

  @Get('roster')
  roster(@Query('programId') programId?: string): Promise<RosterResponse> {
    return this.enrollment.getRoster(this.requireString(programId, 'programId'));
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException({ code: 'invalid_field', message: `${field} is required.` });
    }
    return value;
  }
}
