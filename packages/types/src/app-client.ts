// Which PWA a session belongs to. Carried as the `app` JWT claim and used to
// scope refresh-token rotation + per-app logout (plan A.4/A.5).
export const AppClient = {
  CREATOR: 'creator',
  LEARNER: 'learner',
} as const;

export type AppClient = (typeof AppClient)[keyof typeof AppClient];
