export const ProgramShape = {
  SELF_PACED: 'self_paced',
  COHORT: 'cohort',
  ONE_TO_ONE: 'one_to_one',
  WORKSHOP: 'workshop',
  HYBRID: 'hybrid',
} as const;

export type ProgramShape = (typeof ProgramShape)[keyof typeof ProgramShape];
