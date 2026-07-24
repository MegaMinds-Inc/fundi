import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProgramSummary } from '@fundi/types';
import { PrismaService } from '../../prisma';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Org-scoped list of every program, for the creator app's program picker. */
  async listPrograms(): Promise<ProgramSummary[]> {
    const programs = await this.prisma.client.program.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return programs.map((p) => ({
      id: p.id,
      title: p.title,
      shape: p.shape,
      visibility: p.visibility,
    }));
  }

  /**
   * Org-scoped program + its cohorts, for the roster endpoint. Throws if the
   * program doesn't exist (or belongs to another org — the org-scoped client
   * makes those two cases indistinguishable, which is the correct behaviour).
   */
  async getProgramWithCohorts(programId: string) {
    const program = await this.prisma.client.program.findUnique({
      where: { id: programId },
      include: { cohorts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!program) {
      throw new NotFoundException({ code: 'program_not_found', message: 'Program not found.' });
    }
    return program;
  }
}
