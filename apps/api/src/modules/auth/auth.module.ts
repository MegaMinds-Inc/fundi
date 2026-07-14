import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { PhoneService } from './phone.service';
import { OtpDeliveryService, StubOtpDeliveryService } from './otp-delivery.service';
import { AuthGuard } from './auth.guard';
import { OrgContextInterceptor } from './org-context.interceptor';
import { OrgContextExceptionFilter } from './org-context.filter';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OTP_REQUEST_THROTTLE_LIMIT,
  OTP_REQUEST_THROTTLE_TTL_MS,
  resolveJwtSecret,
} from './auth.constants';

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
    { provide: OtpDeliveryService, useClass: StubOtpDeliveryService },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
    { provide: APP_FILTER, useClass: OrgContextExceptionFilter },
  ],
  exports: [TokenService, AuthService],
})
export class AuthModule {}
