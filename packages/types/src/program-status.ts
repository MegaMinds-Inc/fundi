export const ProgramStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];
