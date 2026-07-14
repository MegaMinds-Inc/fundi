import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppClient } from '@prisma/client';
import type { Onboarding, OtpRequest, OtpVerify, Principal } from '@fundi/types';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentPrincipal } from './principal.decorator';
import type { AuthenticatedRequest } from './principal.decorator';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_NAME_HOST } from './auth.constants';
import type {
  MeApiResult,
  OnboardingApiResult,
  RefreshApiResult,
  VerifyOtpApiResult,
} from './auth.responses';

/**
 * The auth surface (plan A.5). The four pre-auth endpoints are `@Public()` so
 * they bypass the global guard; `/auth/onboarding` and `/auth/me` require a
 * valid access token but tolerate a missing `org` claim (the org-less
 * onboarding token may reach only these two).
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
  async verifyOtp(@Body() body: OtpVerify): Promise<VerifyOtpApiResult> {
    const phone = this.requireString(body?.phone, 'phone');
    const code = this.requireString(body?.code, 'code');
    const app = this.requireApp(body?.app);
    return this.auth.verifyOtp(phone, code, app);
  }

  @Post('onboarding')
  @HttpCode(200)
  async onboarding(
    @CurrentPrincipal() principal: Principal,
    @Body() body: Onboarding,
  ): Promise<OnboardingApiResult> {
    const orgName = this.requireString(body?.orgName, 'orgName');
    const name = this.requireString(body?.name, 'name');
    return this.auth.onboard(principal, orgName, name);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Body() body: { refreshToken?: string },
  ): Promise<RefreshApiResult> {
    const token = this.extractRefreshToken(request, body);
    return this.auth.refresh(token);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Body() body: { refreshToken?: string },
  ): Promise<void> {
    const token = this.extractRefreshToken(request, body);
    await this.auth.logout(token);
  }

  @Get('me')
  async me(@CurrentPrincipal() principal: Principal): Promise<MeApiResult> {
    return this.auth.me(principal);
  }

  private extractRefreshToken(
    request: AuthenticatedRequest,
    body: { refreshToken?: string },
  ): string {
    if (typeof body?.refreshToken === 'string' && body.refreshToken.length > 0) {
      return body.refreshToken;
    }
    const cookies = (request as { cookies?: Record<string, string> }).cookies;
    const fromCookie = cookies?.[REFRESH_COOKIE_NAME_HOST] ?? cookies?.[REFRESH_COOKIE_NAME];
    if (fromCookie) {
      return fromCookie;
    }
    throw new BadRequestException({ code: 'missing_refresh_token', message: 'No refresh token.' });
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
