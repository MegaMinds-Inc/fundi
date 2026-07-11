export const EnrollmentState = {
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
} as const;

export type EnrollmentState = (typeof EnrollmentState)[keyof typeof EnrollmentState];
