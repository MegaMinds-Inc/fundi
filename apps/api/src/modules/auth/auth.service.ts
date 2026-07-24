import { createHash, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AppClient, MentorRole } from '@prisma/client';
import type { MembershipDTO, Principal } from '@fundi/types';
import { PrismaService, runWithOrgContext } from '../../prisma';
import { OtpService } from './otp.service';
import { PhoneService } from './phone.service';
import { TokenService } from './token.service';
import { PinService } from './pin.service';
import { TrustedDeviceService } from './trusted-device.service';
import { SmsBudgetService } from './sms-budget.service';
import type {
  IssuedTokens,
  MeApiResult,
  OnboardingApiResult,
  PinVerifyApiResult,
  RefreshApiResult,
  SetPinApiResult,
  VerifyOtpApiResult,
} from './auth.responses';

/** Fresh-proof for replacing an existing PIN (feature 0010 §7.1) — the current
 * PIN or a just-issued OTP code for the account phone. A first-time set needs
 * neither (session auth alone). */
export interface PinChangeProof {
  currentPin?: string;
  otpCode?: string;
}

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
    private readonly pins: PinService,
    private readonly trustedDevices: TrustedDeviceService,
    private readonly smsBudget: SmsBudgetService,
  ) {}

  /** `POST /auth/otp/request` — issue + dispatch a code. Never reveals whether
   * the phone maps to an existing account (enumeration-safe). */
  async requestOtp(phoneInput: string): Promise<void> {
    const phone = this.phone.normalize(phoneInput);
    // Global SMS-budget breaker BEFORE the send (§7.7). Fails closed the same way
    // for every phone, so it never becomes an enumeration oracle.
    await this.smsBudget.assertWithinBudget();
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

    // Enrollment is where device trust is minted (§2/§6): a verified OTP proved
    // phone ownership, so this browser is now a trusted device for `app`. The
    // secret rides back to the BFF, which sets the `__Host-fundi_dt` cookie.
    const device = await this.trustedDevices.issue(account.id, app);
    // A null `pinHash` means the account has never set a PIN → the BFF shows the
    // first-run PIN-setup nudge (§6). Never surfaces the hash itself.
    const needsPinSetup = account.pinHash == null;

    const memberships = await this.getMemberships(account.id);
    const active = this.pickActiveMembership(memberships, app);

    if (active) {
      const issued = await this.issuePair(account.id, app, active.organisationId, active.role);
      return {
        tokens: issued,
        needsOnboarding: false,
        memberships,
        needsPinSetup,
        deviceSecret: device.secret,
      };
    }

    // No membership for this app yet. A creator must bootstrap an org first
    // (org-less token, gated to /auth/onboarding + /auth/me); a learner simply
    // has no programs yet (legit empty state, plan B.6) — still a valid session.
    const issued = await this.issuePair(account.id, app, undefined, this.provisionalRole(app));
    return {
      tokens: issued,
      needsOnboarding: app === AppClient.creator,
      memberships,
      needsPinSetup,
      deviceSecret: device.secret,
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

  /** `POST /auth/logout` — revoke ONLY the presented refresh token and its whole
   * family; the `TrustedDevice` row is deliberately LEFT enrolled (§13.3). The
   * session ends, but the device stays trusted, so the next entry is a free PIN
   * step-up rather than a paid SMS-OTP. Full un-trust is the explicit "Not you?"/
   * `device/forget` action (and refresh-reuse/theft detection), not logout.
   * Scoped to the presented token's `app` by construction (a creator token's
   * family is separate from a learner's). Idempotent: an unknown token revokes
   * nothing. */
  async logout(rawToken: string): Promise<void> {
    await this.tokens.revokeByToken(rawToken);
  }

  /**
   * `POST /auth/pin/set` (§7.1). FIRST-SET (no existing `pinHash`) is allowed on
   * session auth alone. REPLACE (a PIN already exists) REQUIRES a fresh proof —
   * the current PIN or a just-issued OTP for the account phone — never a bare
   * access token; a replace without proof is rejected `403 pin_change_requires_proof`.
   * A successful replace also revokes the account's OTHER refresh families for
   * this app (compromise hygiene), keeping only the caller's current session
   * (identified by `currentRefreshToken`, when present). The PIN is never logged.
   */
  async setPin(
    principal: Principal,
    pin: string,
    proof?: PinChangeProof,
    currentRefreshToken?: string,
  ): Promise<SetPinApiResult> {
    const account = await this.prisma.client.account.findUniqueOrThrow({
      where: { id: principal.accountId },
      select: { id: true, phone: true, pinHash: true, pinSalt: true },
    });

    const isReplace = account.pinHash != null;
    if (isReplace) {
      const proven = await this.hasFreshPinProof(account, proof);
      if (!proven) {
        throw new ForbiddenException({
          code: 'pin_change_requires_proof',
          message: 'Changing your PIN requires your current PIN or a fresh code.',
        });
      }
    }

    // Delegates length/blocklist validation (throws 422 pin_invalid/weak_pin).
    await this.pins.setPin(account.id, pin);

    if (isReplace) {
      // Compromise hygiene: burn every OTHER live refresh family for this app,
      // keeping the caller's current one alive so they stay signed in.
      await this.revokeOtherFamilies(account.id, principal.app, currentRefreshToken);
    }

    return { ok: true };
  }

  /**
   * `POST /auth/pin/verify` (§4.3/§4.4, §7.5) — the free step-up. Gated on a
   * valid device cookie: a null resolution is a UNIFORM `401 pin_rejected` (no
   * device-existence leak). `app`/`accountId` are derived from the device row, so
   * a learner device can never mint a creator token. Any non-ok PIN outcome
   * (wrong OR locked) collapses to the SAME `401 pin_rejected` (no invalid-vs-
   * locked oracle). On success: revoke the lapsed refresh family (when the client
   * still presents its cookie so it is resolvable), mint a FRESH pair on a new
   * family, rotate the device secret, and hand back the rotated secret. NO SMS.
   */
  async stepUpWithPin(
    deviceSecret: string,
    app: AppClient,
    pin: string,
    lapsedRefreshToken?: string,
  ): Promise<PinVerifyApiResult> {
    const device = await this.trustedDevices.verifyCookie(deviceSecret, app);
    if (!device) {
      throw this.pinRejected();
    }

    const result = await this.pins.verifyPin(device, pin);
    if (!result.ok) {
      // invalid vs locked is internal only — one uniform error to the client.
      throw this.pinRejected();
    }

    // Retire the lapsed family that sent the user here, when it is resolvable
    // from the still-presented (idle/cap-lapsed) refresh cookie.
    if (lapsedRefreshToken) {
      await this.revokeFamilyByToken(lapsedRefreshToken);
    }

    const memberships = await this.getMemberships(device.accountId);
    const active = this.pickActiveMembership(memberships, app);
    const issued = await this.issuePair(
      device.accountId,
      app,
      active?.organisationId,
      active?.role ?? this.provisionalRole(app),
    );

    // Rotate the device secret on every successful step-up (§5/§7.2): a copied
    // cookie is caught on its next use.
    const rotated = await this.trustedDevices.rotateSecret(device);

    return { ...issued, deviceSecret: rotated.secret, memberships };
  }

  /**
   * `POST /auth/pin/reset` (§4.6/§12.6) — the phone-less end of the forgot-PIN
   * flow: `pin/forgot` has already sent a reset OTP, and this call consumes that
   * OTP AND sets the new PIN in ONE step, landing the user signed in. Gated on a
   * valid device cookie (the same uniform `401 pin_rejected` as {@link
   * stepUpWithPin} on any device/OTP miss — NO device/account/otp existence
   * oracle). Only {@link PinService.setPin}'s `422 pin_invalid`/`weak_pin`
   * propagates (a form error, not session death — exactly like `pin/set`).
   *
   * 1. resolve the device (null → uniform 401); 2. resolve the account phone
   * (missing → uniform 401); 3. `otp.verify` consumes the reset OTP — the
   * phone-ownership proof, carrying the existing OTP attempt cap (any throw →
   * uniform 401, no otp_invalid/otp_expired leak); 4. `pins.setPin` (422
   * propagates as-is); 5. compromise hygiene — revoke ALL live refresh families
   * for this account+app (no session to keep) plus the lapsed one; 6. mint a
   * fresh pair on a NEW family + rotate the device secret. The PIN/OTP are never
   * logged.
   */
  async resetPin(
    deviceSecret: string,
    app: AppClient,
    otpCode: string,
    pin: string,
    lapsedRefreshToken?: string,
  ): Promise<PinVerifyApiResult> {
    const device = await this.trustedDevices.verifyCookie(deviceSecret, app);
    if (!device) {
      throw this.pinRejected();
    }

    const account = await this.prisma.client.account.findUnique({
      where: { id: device.accountId },
      select: { phone: true },
    });
    if (!account) {
      throw this.pinRejected();
    }

    // Consume the reset OTP — this IS the phone-ownership proof (it carries the
    // OTP attempt cap). A wrong/expired/locked code collapses to the SAME uniform
    // 401 as a device miss (no otp_invalid-vs-otp_expired oracle here).
    try {
      await this.otp.verify(account.phone, otpCode);
    } catch {
      throw this.pinRejected();
    }

    // Set the new PIN. Its 422 pin_invalid/weak_pin is a form error and MUST
    // propagate as-is (not collapse to pin_rejected), exactly like `pin/set`.
    await this.pins.setPin(device.accountId, pin);

    // Compromise hygiene: a reset keeps NO existing session, so burn every live
    // family for this account+app (passing no keep-token revokes ALL of them),
    // plus the lapsed family the client still holds, before minting the new one.
    await this.revokeOtherFamilies(device.accountId, app);
    if (lapsedRefreshToken) {
      await this.revokeFamilyByToken(lapsedRefreshToken);
    }

    const memberships = await this.getMemberships(device.accountId);
    const active = this.pickActiveMembership(memberships, app);
    const issued = await this.issuePair(
      device.accountId,
      app,
      active?.organisationId,
      active?.role ?? this.provisionalRole(app),
    );

    // Rotate the device secret (§5/§7.2) so a copied cookie is caught next use.
    const rotated = await this.trustedDevices.rotateSecret(device);

    return { ...issued, deviceSecret: rotated.secret, memberships };
  }

  /**
   * `POST /auth/pin/forgot` (§4.6, §7.7) — server-driven reset send. The account
   * is resolved from the device cookie (the client supplies NO phone), the global
   * SMS-budget breaker is enforced, then the normal OTP request path runs for the
   * account's phone (reusing its cooldown/cap). Returns void → 204. An
   * unresolvable device is a silent no-op (enumeration-safe: no distinct
   * response reveals device/account existence).
   */
  async forgotPin(deviceSecret: string, app: AppClient): Promise<void> {
    const device = await this.trustedDevices.verifyCookie(deviceSecret, app);
    if (!device) {
      return;
    }
    const account = await this.prisma.client.account.findUnique({
      where: { id: device.accountId },
      select: { phone: true },
    });
    if (!account) {
      return;
    }
    await this.smsBudget.assertWithinBudget();
    await this.otp.request(account.phone);
  }

  /**
   * `POST /auth/device/forget` (§4 "Not you?") — revoke the current trusted-device
   * row so the next entry is a full OTP. The httpOnly cookie itself is cleared by
   * the controller (JS cannot delete it). Idempotent: an unresolvable cookie
   * revokes nothing.
   */
  async forgetDevice(deviceSecret: string, app: AppClient): Promise<void> {
    const device = await this.trustedDevices.verifyCookie(deviceSecret, app);
    if (device) {
      await this.trustedDevices.revokeById(device.id);
    }
  }

  /** `GET /auth/me` — principal + memberships + live PIN-setup state for the UI
   * auth gate. `needsPinSetup` is read from the DB (`pinHash == null`), NOT a
   * token claim, so it self-clears the instant a PIN is set — the mandatory
   * PIN-setup gate (feature 0010 CHANGE 1) reads it here and can never loop on a
   * stale token. The hash itself is never surfaced. */
  async me(principal: Principal): Promise<MeApiResult> {
    const account = await this.prisma.client.account.findUniqueOrThrow({
      where: { id: principal.accountId },
      select: { pinHash: true },
    });
    const memberships = await this.getMemberships(principal.accountId);
    return { principal, memberships, needsPinSetup: account.pinHash == null };
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

  /**
   * True when a fresh proof for a PIN REPLACE is satisfied (§7.1): a matching
   * current PIN (constant-time compared against the stored hash) OR a valid,
   * just-issued OTP for the account phone (consumed on verify). Wrong/missing
   * proof returns false — the caller maps that to one uniform 403 (no oracle on
   * which proof failed). Reuses {@link PinService.hashPin} so the current-PIN
   * check does not need a device row.
   */
  private async hasFreshPinProof(
    account: { phone: string; pinHash: string | null; pinSalt: string | null },
    proof?: PinChangeProof,
  ): Promise<boolean> {
    if (proof?.currentPin && account.pinHash && account.pinSalt) {
      const expected = Buffer.from(account.pinHash, 'hex');
      const actual = Buffer.from(await this.pins.hashPin(proof.currentPin, account.pinSalt), 'hex');
      if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
        return true;
      }
    }
    if (proof?.otpCode) {
      try {
        // Consumes a fresh OTP for the account phone as the change proof.
        await this.otp.verify(account.phone, proof.otpCode);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Revoke every live refresh family for `accountId`+`app` EXCEPT the one backing
   * the caller's current session (resolved from `keepRefreshToken`, when given).
   * Done via Prisma directly (token.service exposes only whole-family or
   * by-token revocation). Compromise hygiene after a PIN replace (§7.1).
   */
  private async revokeOtherFamilies(
    accountId: string,
    app: AppClient,
    keepRefreshToken?: string,
  ): Promise<void> {
    let keepFamilyId: string | undefined;
    if (keepRefreshToken) {
      const current = await this.prisma.client.refreshToken.findUnique({
        where: { tokenHash: this.hashRefreshToken(keepRefreshToken) },
        select: { familyId: true },
      });
      keepFamilyId = current?.familyId;
    }
    await this.prisma.client.refreshToken.updateMany({
      where: {
        accountId,
        app,
        revokedAt: null,
        ...(keepFamilyId ? { NOT: { familyId: keepFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke the whole family of a presented refresh token (the lapsed session on
   * a PIN step-up). No-op for an unknown token. */
  private async revokeFamilyByToken(rawToken: string): Promise<void> {
    const row = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
      select: { familyId: true },
    });
    if (row) {
      await this.prisma.client.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  /** SHA-256 of a raw refresh token — mirrors `TokenService`'s at-rest hashing so
   * a token can be looked up by its stored `tokenHash`. */
  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** The single uniform step-up failure (§7.5): device-cookie miss, wrong PIN,
   * and lockout all collapse to this — no existence/lock oracle for the client. */
  private pinRejected(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'pin_rejected',
      message: 'That PIN could not be verified.',
    });
  }
}
