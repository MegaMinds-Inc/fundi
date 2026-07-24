import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AppClient } from '@prisma/client';
import type {
  DeviceForget,
  Onboarding,
  OtpRequest,
  OtpVerify,
  PinForgot,
  PinReset,
  PinSet,
  PinVerify,
  Principal,
} from '@fundi/types';
import { AuthService } from './auth.service';
import type { PinChangeProof } from './auth.service';
import { Public } from './public.decorator';
import { CurrentPrincipal } from './principal.decorator';
import type { AuthenticatedRequest } from './principal.decorator';
import {
  ACCESS_COOKIE_NAME_HOST,
  AUTH_COOKIE_SAMESITE,
  DEVICE_COOKIE_NAME,
  DEVICE_COOKIE_NAME_HOST,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_NAME_HOST,
  TRUSTED_DEVICE_TTL_SECONDS,
} from './auth.constants';
import type {
  IssuedTokens,
  MeApiResult,
  OnboardingApiResult,
  PinVerifyApiResult,
  RefreshApiResult,
  SetPinApiResult,
  VerifyOtpApiResult,
} from './auth.responses';

/**
 * The auth surface (plan A.5 + feature 0010 §6). Pre-auth endpoints are
 * `@Public()` so they bypass the global guard; `/auth/onboarding`, `/auth/me`
 * and `/auth/pin/set` require a valid access token.
 *
 * This controller now also SETS the httpOnly auth cookies on the API response
 * (access/refresh/device), all with `SameSite` from `AUTH_COOKIE_SAMESITE`
 * (§7.6) and the `__Host-` prefix. The opaque secrets remain in the response
 * body too, so the server-to-server BFF can continue to read them; the browser
 * only ever holds the cookies.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('otp/request')
  @HttpCode(204)
  async requestOtp(@Body() body: OtpRequest): Promise<void> {
    const phone = this.requireString(body?.phone, 'phone');
    // Always 204, whether or not the phone maps to an account (no enumeration).
    await this.auth.requestOtp(phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body() body: OtpVerify,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyOtpApiResult> {
    const phone = this.requireString(body?.phone, 'phone');
    const code = this.requireString(body?.code, 'code');
    const app = this.requireApp(body?.app);
    const result = await this.auth.verifyOtp(phone, code, app);
    // Enrollment sets the session cookies AND mints the device-trust cookie.
    if (result.tokens) {
      this.setTokenCookies(res, result.tokens);
    }
    if (result.deviceSecret) {
      this.setDeviceCookie(res, result.deviceSecret);
    }
    return result;
  }

  @Post('onboarding')
  @HttpCode(200)
  async onboarding(
    @CurrentPrincipal() principal: Principal,
    @Body() body: Onboarding,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OnboardingApiResult> {
    const orgName = this.requireString(body?.orgName, 'orgName');
    const name = this.requireString(body?.name, 'name');
    const result = await this.auth.onboard(principal, orgName, name);
    // Re-issued token now carries the org claim — refresh the session cookies.
    this.setTokenCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshApiResult> {
    const token = this.extractRefreshToken(request, body);
    // rotateRefreshToken throws 401 with a distinct `code`
    // (reauth_required / session_expired / invalid_grant); it is NOT swallowed —
    // Nest serialises it straight through so the BFF router can branch.
    const result = await this.auth.refresh(token);
    this.setTokenCookies(res, result);
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = this.extractRefreshToken(request, body);
    await this.auth.logout(token);
    // Clear every auth cookie, including device trust (§4.8).
    this.clearAuthCookies(res);
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<MeApiResult> {
    return this.auth.me(principal);
  }

  /**
   * `POST /auth/pin/set` (authenticated, §7.1). First-set on session auth alone;
   * a replace requires `currentPin`/`otpCode` proof. CSRF posture: `SameSite`
   * plus an explicit cross-site `Sec-Fetch-Site` rejection.
   */
  @Post('pin/set')
  @HttpCode(200)
  async setPin(
    @CurrentPrincipal() principal: Principal,
    @Body() body: PinSet,
    @Req() request: AuthenticatedRequest,
  ): Promise<SetPinApiResult> {
    this.rejectCrossSite(request);
    const pin = this.requireString(body?.pin, 'pin');
    const proof: PinChangeProof = {
      ...(typeof body?.currentPin === 'string' ? { currentPin: body.currentPin } : {}),
      ...(typeof body?.otpCode === 'string' ? { otpCode: body.otpCode } : {}),
    };
    const currentRefreshToken = this.extractRefreshTokenOptional(request);
    return this.auth.setPin(principal, pin, proof, currentRefreshToken);
  }

  /**
   * `POST /auth/pin/verify` (`@Public`, device-cookie-gated step-up, §4.3/§7.5).
   * Per-IP throttled. A missing/invalid device cookie or any PIN miss returns the
   * SAME uniform `401 pin_rejected`. On success, sets refreshed access+refresh
   * cookies and the ROTATED device cookie.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('pin/verify')
  @HttpCode(200)
  async verifyPin(
    @Body() body: PinVerify,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PinVerifyApiResult> {
    this.rejectCrossSite(request);
    const pin = this.requireString(body?.pin, 'pin');
    const app = this.requireApp(body?.app);
    const deviceSecret = this.extractDeviceCookie(request) ?? '';
    const lapsedRefreshToken = this.extractRefreshTokenOptional(request);
    const result = await this.auth.stepUpWithPin(deviceSecret, app, pin, lapsedRefreshToken);
    this.setTokenCookies(res, result);
    this.setDeviceCookie(res, result.deviceSecret);
    return result;
  }

  /**
   * `POST /auth/pin/reset` (`@Public`, device-cookie-gated forgot-PIN reset,
   * §4.6/§12.6). Closes the reset dead-end: consumes the reset OTP (phone-
   * ownership proof) AND sets the new PIN in ONE call, then mints a fresh signed-
   * in session. A missing/invalid device cookie or a wrong/expired OTP is the
   * SAME uniform `401 pin_rejected` (no enumeration); only `setPin`'s 422
   * pin_invalid/weak_pin propagates as a form error. On success sets refreshed
   * access+refresh cookies and the ROTATED device cookie → the user lands in.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('pin/reset')
  @HttpCode(200)
  async resetPin(
    @Body() body: PinReset,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PinVerifyApiResult> {
    this.rejectCrossSite(request);
    const otpCode = this.requireString(body?.otpCode, 'otpCode');
    const pin = this.requireString(body?.pin, 'pin');
    const app = this.requireApp(body?.app);
    const deviceSecret = this.extractDeviceCookie(request) ?? '';
    const lapsedRefreshToken = this.extractRefreshTokenOptional(request);
    const result = await this.auth.resetPin(deviceSecret, app, otpCode, pin, lapsedRefreshToken);
    this.setTokenCookies(res, result);
    this.setDeviceCookie(res, result.deviceSecret);
    return result;
  }

  /**
   * `POST /auth/pin/forgot` (`@Public`, server-driven, §4.6/§7.7). Resolves the
   * account from the device cookie (no phone in the body), enforces the SMS
   * budget breaker, and sends a reset OTP. Always 204 (enumeration-safe).
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('pin/forgot')
  @HttpCode(204)
  async forgotPin(@Body() body: PinForgot, @Req() request: AuthenticatedRequest): Promise<void> {
    this.rejectCrossSite(request);
    const app = this.requireApp(body?.app);
    const deviceSecret = this.extractDeviceCookie(request) ?? '';
    await this.auth.forgotPin(deviceSecret, app);
  }

  /**
   * `POST /auth/device/forget` (`@Public`, §4 "Not you?"). Revokes the current
   * trusted-device row and clears the httpOnly device cookie (JS cannot). 204.
   */
  @Public()
  @Post('device/forget')
  @HttpCode(204)
  async forgetDevice(
    @Body() body: DeviceForget,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    this.rejectCrossSite(request);
    const app = this.requireApp(body?.app);
    const deviceSecret = this.extractDeviceCookie(request) ?? '';
    await this.auth.forgetDevice(deviceSecret, app);
    this.clearDeviceCookie(res);
  }

  // --- cookies ---------------------------------------------------------------

  /** Shared attributes for every auth cookie: httpOnly + Secure + `Path=/` +
   * `SameSite` from `AUTH_COOKIE_SAMESITE` (§7.6). The `__Host-` prefix requires
   * exactly these (Secure, Path=/, no Domain). */
  private cookieOptions(maxAgeSeconds?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: AUTH_COOKIE_SAMESITE,
      ...(maxAgeSeconds != null ? { maxAge: maxAgeSeconds * 1000 } : {}),
    };
  }

  private setTokenCookies(res: Response, tokens: IssuedTokens): void {
    res.cookie(ACCESS_COOKIE_NAME_HOST, tokens.accessToken, this.cookieOptions(tokens.expiresIn));
    res.cookie(
      REFRESH_COOKIE_NAME_HOST,
      tokens.refreshToken,
      this.cookieOptions(tokens.refreshExpiresIn),
    );
  }

  private setDeviceCookie(res: Response, secret: string): void {
    res.cookie(DEVICE_COOKIE_NAME_HOST, secret, this.cookieOptions(TRUSTED_DEVICE_TTL_SECONDS));
  }

  private clearDeviceCookie(res: Response): void {
    res.clearCookie(DEVICE_COOKIE_NAME_HOST, this.cookieOptions());
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE_NAME_HOST, this.cookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME_HOST, this.cookieOptions());
    this.clearDeviceCookie(res);
  }

  // --- request parsing -------------------------------------------------------

  private extractRefreshToken(
    request: AuthenticatedRequest,
    body: { refreshToken?: string },
  ): string {
    if (typeof body?.refreshToken === 'string' && body.refreshToken.length > 0) {
      return body.refreshToken;
    }
    const fromCookie = this.extractRefreshTokenOptional(request);
    if (fromCookie) {
      return fromCookie;
    }
    throw new BadRequestException({ code: 'missing_refresh_token', message: 'No refresh token.' });
  }

  private extractRefreshTokenOptional(request: AuthenticatedRequest): string | undefined {
    const cookies = (request as { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE_NAME_HOST] ?? cookies?.[REFRESH_COOKIE_NAME];
  }

  private extractDeviceCookie(request: AuthenticatedRequest): string | undefined {
    const cookies = (request as { cookies?: Record<string, string> }).cookies;
    return cookies?.[DEVICE_COOKIE_NAME_HOST] ?? cookies?.[DEVICE_COOKIE_NAME];
  }

  /**
   * Reject a cross-site POST (§7.6). `Sec-Fetch-Site: cross-site` is a forged
   * cross-origin submission; same-origin/same-site/none (top-level nav) and the
   * header being absent (server-to-server BFF, non-browser clients) are allowed.
   */
  private rejectCrossSite(request: AuthenticatedRequest): void {
    const site = request.headers['sec-fetch-site'];
    if (site === 'cross-site') {
      throw new ForbiddenException({
        code: 'cross_site_forbidden',
        message: 'Cross-site requests are not allowed on this endpoint.',
      });
    }
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException({ code: 'invalid_field', message: `${field} is required.` });
    }
    return value;
  }

  private requireApp(value: unknown): AppClient {
    if (value === AppClient.creator || value === AppClient.learner) {
      return value;
    }
    throw new BadRequestException({
      code: 'invalid_field',
      message: `app must be one of ${AppClient.creator}, ${AppClient.learner}.`,
    });
  }
}
