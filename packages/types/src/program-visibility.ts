export const ProgramVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} as const;

export type ProgramVisibility = (typeof ProgramVisibility)[keyof typeof ProgramVisibility];
