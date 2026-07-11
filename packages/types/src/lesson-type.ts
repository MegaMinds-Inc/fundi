export const LessonType = {
  TEXT: 'text',
  VIDEO: 'video',
  ATTACHMENT: 'attachment',
  LIVE_ONLINE: 'live_online',
  IN_PERSON: 'in_person',
  QUIZ: 'quiz',
} as const;

export type LessonType = (typeof LessonType)[keyof typeof LessonType];
