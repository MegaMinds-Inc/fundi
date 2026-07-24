import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { PhoneService } from './phone.service';
import { PinService } from './pin.service';
import { TrustedDeviceService } from './trusted-device.service';
import { SmsBudgetService } from './sms-budget.service';
import { OtpDeliveryService, StubOtpDeliveryService } from './otp-delivery.service';
import { SmsOtpDeliveryService } from './sms-otp-delivery.service';
import { SmsProvider } from './sms-provider';
import { VynfySmsProvider } from './providers/vynfy-sms.provider';
import { AuthGuard } from './auth.guard';
import { OrgContextInterceptor } from './org-context.interceptor';
import { OrgContextExceptionFilter } from './org-context.filter';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OTP_EXPIRY_MINUTES,
  OTP_REQUEST_THROTTLE_LIMIT,
  OTP_REQUEST_THROTTLE_TTL_MS,
  resolveJwtSecret,
  resolveOtpDeliveryDriver,
  resolveOtpMessageTemplate,
  resolveSmsProviderName,
  resolveSmsSenderId,
  resolveVynfyConfig,
  type SmsProviderName,
} from './auth.constants';

/**
 * Build the SMS provider adaptor selected by `SMS_PROVIDER` (feature 0009).
 * The switch is the only place a new provider is registered; everything else is
 * provider-agnostic. `resolveSmsProviderName` has already rejected unknown
 * values, so the default arm is unreachable in practice.
 */
function createSmsProvider(name: SmsProviderName): SmsProvider {
  switch (name) {
    case 'vynfy':
      return new VynfySmsProvider(resolveVynfyConfig());
    default:
      throw new Error(`No SMS provider adaptor for '${name as string}'.`);
  }
}

/**
 * Choose the OTP delivery driver from config at DI time. `stub` (the default,
 * used by dev + CI) keeps the current console/recording behaviour; `sms` wires
 * the real provider path. Required secrets are validated here, so a
 * misconfigured `sms` deploy fails loudly at boot rather than dropping codes.
 */
function createOtpDeliveryService(): OtpDeliveryService {
  if (resolveOtpDeliveryDriver() === 'stub') {
    return new StubOtpDeliveryService();
  }
  return new SmsOtpDeliveryService(createSmsProvider(resolveSmsProviderName()), {
    senderId: resolveSmsSenderId(),
    messageTemplate: resolveOtpMessageTemplate(),
    expiryMinutes: OTP_EXPIRY_MINUTES,
    metadata: { purpose: 'otp' },
  });
}

/**
 * The auth module. It registers three GLOBAL providers that switch the
 * org-scope engine on for the whole app:
 *  - {@link AuthGuard} (APP_GUARD) — verifies the access JWT, attaches the
 *    principal, honours `@Public()`.
 *  - {@link OrgContextInterceptor} (APP_INTERCEPTOR) — binds org context from
 *    the principal for every non-public request.
 *  - {@link OrgContextExceptionFilter} (APP_FILTER) — maps the engine's
 *    loud-fail errors to `403`, never a silent success.
 *
 * `JwtModule` is registered with `registerAsync`/`useFactory` so the signing
 * secret is resolved at DI time (tests can inject a fixed `JWT_SECRET` first),
 * never captured at import time.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: resolveJwtSecret(),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
    // Per-IP throttle for POST /auth/otp/request (applied via ThrottlerGuard on
    // that route only). Default named config, in-memory storage.
    ThrottlerModule.forRoot([
      { ttl: OTP_REQUEST_THROTTLE_TTL_MS, limit: OTP_REQUEST_THROTTLE_LIMIT },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    PhoneService,
    PinService,
    TrustedDeviceService,
    SmsBudgetService,
    { provide: OtpDeliveryService, useFactory: createOtpDeliveryService },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
    { provide: APP_FILTER, useClass: OrgContextExceptionFilter },
  ],
  exports: [TokenService, AuthService],
})
export class AuthModule {}
