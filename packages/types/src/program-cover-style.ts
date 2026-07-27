export const ProgramCoverStyle = {
  GRADIENT: 'gradient',
  GEOMETRIC: 'geometric',
} as const;

export type ProgramCoverStyle = (typeof ProgramCoverStyle)[keyof typeof ProgramCoverStyle];
