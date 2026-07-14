import { ForbiddenException, Injectable } from '@nestjs/common';
import { AppClient, MentorRole } from '@prisma/client';
import type { MembershipDTO, Principal } from '@fundi/types';
import { PrismaService, runWithOrgContext } from '../../prisma';
import { OtpService } from './otp.service';
import { PhoneService } from './phone.service';
import { TokenService } from './token.service';
import type {
  IssuedTokens,
  MeApiResult,
  OnboardingApiResult,
  RefreshApiResult,
  VerifyOtpApiResult,
} from './auth.responses';

/**
 * Orchestrates the auth flows on top of the focused services: normalises the
 * phone, drives the OTP lifecycle, resolves the account and its memberships,
 * and mints/rotates the token pair. The org-bootstrap on first-run onboarding
 * (Multi-tenancy US-001) lives here because it is the one place that crosses
 * from pre-context (unscoped `Account`/`Organisation`) into an org context to
 * stamp the owner `Mentor` — never by hand (plan A.6).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phone: PhoneService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  /** `POST /auth/otp/request` — issue + dispatch a code. Never reveals whether
   * the phone maps to an existing account (enumeration-safe). */
  async requestOtp(phoneInput: string): Promise<void> {
    const phone = this.phone.normalize(phoneInput);
    await this.otp.request(phone);
  }

  /** `POST /auth/otp/verify` — validate the code, find-or-create the account,
   * and issue a token pair. A first-time creator with no membership gets an
   * org-less token + `needsOnboarding: true` (pre-decided onboarding flow). */
  async verifyOtp(phoneInput: string, code: string, app: AppClient): Promise<VerifyOtpApiResult> {
    const phone = this.phone.normalize(phoneInput);
    await this.otp.verify(phone, code);

    const account = await this.prisma.client.account.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });

    const memberships = await this.getMemberships(account.id);
    const active = this.pickActiveMembership(memberships, app);

    if (active) {
      const issued = await this.issuePair(account.id, app, active.organisationId, active.role);
      return { tokens: issued, needsOnboarding: false, memberships };
    }

    // No membership for this app yet. A creator must bootstrap an org first
    // (org-less token, gated to /auth/onboarding + /auth/me); a learner simply
    // has no programs yet (legit empty state, plan B.6) — still a valid session.
    const issued = await this.issuePair(account.id, app, undefined, this.provisionalRole(app));
    return {
      tokens: issued,
      needsOnboarding: app === AppClient.creator,
      memberships,
    };
  }

  /** `POST /auth/onboarding` — bootstrap the Organisation + owner Mentor +
   * Membership for a first-time creator, then re-issue a token carrying `org`.
   * Idempotent: if the account already owns an org, recover rather than
   * duplicate (QA C.5 / D.5). */
  async onboard(principal: Principal, orgName: string, name: string): Promise<OnboardingApiResult> {
    if (principal.app !== AppClient.creator) {
      throw new ForbiddenException({
        code: 'onboarding_creator_only',
        message: 'Only a creator can create a workspace.',
      });
    }

    const account = await this.prisma.client.account.findUniqueOrThrow({
      where: { id: principal.accountId },
    });

    // Idempotency: a re-run after a partial/duplicate submit must not mint a
    // second org. If a creator membership already exists, reuse it.
    const existing = await this.getMemberships(account.id);
    const existingCreator = this.pickActiveMembership(existing, AppClient.creator);
    if (existingCreator) {
      const issued = await this.issuePair(
        account.id,
        AppClient.creator,
        existingCreator.organisationId,
        existingCreator.role,
      );
      return { tokens: issued, memberships: existing };
    }

    // The full bootstrap runs in ONE interactive transaction so a failure
    // cannot leave an orphan Organisation with no owner (atomicity, QA C.5):
    // create the Organisation (unscoped tenant root), then enter its context to
    // stamp the owner Mentor and bridge the Membership.
    const organisationId = await this.prisma.client.$transaction(async (tx) => {
      const org = await tx.organisation.create({ data: { name: orgName } });
      await runWithOrgContext({ organisationId: org.id }, async () => {
        // organisationId is passed explicitly here (matching the bound context,
        // so the stamp is idempotent) to satisfy Prisma's create-input type —
        // the extension would otherwise inject it at runtime, invisibly to TS.
        const mentor = await tx.mentor.create({
          data: { organisationId: org.id, name, phone: account.phone, role: MentorRole.owner },
        });
        await tx.membership.create({
          data: {
            accountId: account.id,
            organisationId: org.id,
            role: MentorRole.owner,
            mentorId: mentor.id,
          },
        });
      });
      return org.id;
    });

    const memberships = await this.getMemberships(account.id);
    const issued = await this.issuePair(
      account.id,
      AppClient.creator,
      organisationId,
      MentorRole.owner,
    );
    return { tokens: issued, memberships };
  }

  /** `POST /auth/refresh` — rotate the refresh token (with reuse detection) and
   * re-mint an access token carrying the current active `org`. */
  async refresh(rawToken: string): Promise<RefreshApiResult> {
    const rotated = await this.tokens.rotateRefreshToken(rawToken);
    const memberships = await this.getMemberships(rotated.accountId);
    const active = this.pickActiveMembership(memberships, rotated.app);
    const access = this.tokens.signAccessToken({
      accountId: rotated.accountId,
      app: rotated.app,
      org: active?.organisationId,
      role: active?.role ?? this.provisionalRole(rotated.app),
    });
    return {
      ...access,
      refreshToken: rotated.token,
      refreshExpiresIn: Math.max(0, Math.floor((rotated.expiresAt.getTime() - Date.now()) / 1000)),
    };
  }

  /** `POST /auth/logout` — revoke the presented refresh token and its whole
   * family. Scoped to that token's `app` by construction (a creator token's
   * family is separate from a learner's). Idempotent. */
  async logout(rawToken: string): Promise<void> {
    await this.tokens.revokeByToken(rawToken);
  }

  /** `GET /auth/me` — principal + memberships for the UI auth state. */
  async me(principal: Principal): Promise<MeApiResult> {
    const memberships = await this.getMemberships(principal.accountId);
    return { principal, memberships };
  }

  /** Load every membership for an account, resolved to org name + row. Reads
   * `Membership`/`Organisation` (both non-tenant), so it works pre-context. */
  private async getMemberships(accountId: string): Promise<MembershipDTO[]> {
    const rows = await this.prisma.client.membership.findMany({
      where: { accountId },
      include: { organisation: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      organisationId: row.organisationId,
      organisationName: row.organisation.name,
      role: row.role,
      ...(row.mentorId ? { mentorId: row.mentorId } : {}),
      ...(row.learnerId ? { learnerId: row.learnerId } : {}),
    }));
  }

  /** The membership that backs a session for `app`: a creator session binds to
   * a Mentor-backed membership; a learner session to a Learner-backed one.
   * Sprint 1 is single-org, so the first match is the active org. */
  private pickActiveMembership(
    memberships: MembershipDTO[],
    app: AppClient,
  ): MembershipDTO | undefined {
    if (app === AppClient.creator) {
      return memberships.find((m) => m.mentorId != null);
    }
    return memberships.find((m) => m.learnerId != null);
  }

  private provisionalRole(app: AppClient): MentorRole {
    // Org-less token role is provisional until bootstrap. A creator will become
    // the owner; a learner's role is irrelevant until enrolled.
    return app === AppClient.creator ? MentorRole.owner : MentorRole.mentor;
  }

  private async issuePair(
    accountId: string,
    app: AppClient,
    org: string | undefined,
    role: MentorRole,
  ): Promise<IssuedTokens> {
    const refresh = await this.tokens.createRefreshToken({ accountId, app });
    const access = this.tokens.signAccessToken({ accountId, app, org, role });
    return {
      ...access,
      refreshToken: refresh.token,
      refreshExpiresIn: Math.max(0, Math.floor((refresh.expiresAt.getTime() - Date.now()) / 1000)),
    };
  }
}
