export const ModuleUnlockMode = {
  HIDDEN: 'hidden',
  IMMEDIATE: 'immediate',
  AFTER_PREVIOUS: 'after_previous',
  AFTER_DAYS: 'after_days',
} as const;

export type ModuleUnlockMode = (typeof ModuleUnlockMode)[keyof typeof ModuleUnlockMode];
