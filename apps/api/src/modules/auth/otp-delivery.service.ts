import { Injectable, Logger } from '@nestjs/common';

/**
 * The seam between the auth module and however OTP codes physically reach a
 * user. Sprint 1 ships a console/stub driver; the real SMS driver (WhatsApp
 * fallback later, ADR-001) slots in behind this same interface as separate
 * infra work. Declared as an abstract class so it doubles as the Nest DI token.
 */
export abstract class OtpDeliveryService {
  /** Deliver `code` to `phone`. Implementations must not throw on transient
   * failure in a way that leaks whether the phone exists (no enumeration). */
  abstract send(phone: string, code: string): Promise<void>;
}

/**
 * Console/stub driver (plan A.5 "stubbed first"). It logs that a code was sent
 * and — **only when `NODE_ENV !== 'production'`** — records the last code per
 * phone in memory so DB-integration/HTTP tests can read it back via
 * {@link lastCodeFor} without scraping stdout (QA C.6). The recording buffer is
 * hard-guarded off in production: there, `send` only logs and records nothing.
 */
@Injectable()
export class StubOtpDeliveryService extends OtpDeliveryService {
  private readonly logger = new Logger(StubOtpDeliveryService.name);
  private readonly recording = process.env.NODE_ENV !== 'production';
  private readonly lastCode = new Map<string, string>();
  /** Ordered log of everything "sent" (test-only; empty in production). */
  readonly sent: { phone: string; code: string; at: Date }[] = [];

  async send(phone: string, code: string): Promise<void> {
    if (this.recording) {
      // Test-only affordance (hard-guarded to non-production): expose the code
      // so a recording-fake seam is unnecessary in-process. Never a shipped
      // endpoint — purely an in-memory peek for the test runner.
      this.lastCode.set(phone, code);
      this.sent.push({ phone, code, at: new Date() });
      this.logger.debug(`OTP for ${phone}: ${code} (dev stub — not really sent)`);
    } else {
      // Production: never log the code itself.
      this.logger.log(`Dispatched OTP to ${phone} via stub driver (no real SMS wired yet).`);
    }
    return Promise.resolve();
  }

  /** The most recent code delivered to `phone`, or `undefined`. Non-production
   * only — returns `undefined` in production where nothing is recorded. */
  lastCodeFor(phone: string): string | undefined {
    return this.lastCode.get(phone);
  }
}
