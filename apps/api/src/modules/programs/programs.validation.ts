import { BadRequestException } from '@nestjs/common';

/**
 * Shared request-body validators for the programs module controllers
 * (ProgramsController + the Module/Lesson controllers). Extracted so all three
 * controllers enforce the identical `{ code:'invalid_field', message }` shape
 * slice 1 established, with no duplication.
 */

export function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException({ code: 'invalid_field', message: `${field} is required.` });
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException({
      code: 'invalid_field',
      message: `${field} must be a string.`,
    });
  }
  return value;
}

export function requireEnum<T extends string>(
  value: unknown,
  allowed: Set<string>,
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new BadRequestException({
      code: 'invalid_field',
      message: `${field} must be one of: ${[...allowed].join(', ')}.`,
    });
  }
  return value as T;
}

/** A positive (>= 1) integer, or throws. Used for `Module.unlockDays`. */
export function requirePositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new BadRequestException({
      code: 'invalid_field',
      message: `${field} must be an integer >= 1.`,
    });
  }
  return value;
}
