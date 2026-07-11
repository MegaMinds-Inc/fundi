export const SignalType = {
  LESSON_OVERDUE: 'lesson_overdue',
  REMINDER_UNACKNOWLEDGED: 'reminder_unacknowledged',
  QUIZ_FAILED: 'quiz_failed',
  HELP_REQUESTED: 'help_requested',
  WENT_QUIET: 'went_quiet',
} as const;

export type SignalType = (typeof SignalType)[keyof typeof SignalType];
