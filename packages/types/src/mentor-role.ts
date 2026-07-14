// Mirrors the Prisma `MentorRole` enum (apps/api/prisma/schema.prisma).
// Membership.role reuses this role (plan A.3), so it doubles as the authz role.
export const MentorRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MENTOR: 'mentor',
} as const;

export type MentorRole = (typeof MentorRole)[keyof typeof MentorRole];
