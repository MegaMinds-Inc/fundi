import { Logger } from '@nestjs/common';
import { OtpDeliveryService } from './otp-delivery.service';
import { SmsProvider, SmsProviderError } from './sms-provider';

/**
 * Config for the real SMS delivery driver, assembled from env by the auth
 * module (feature 0009 §5). Kept provider-independent — the concrete provider
 * arrives as the injected {@link SmsProvider}.
 */
export interface SmsOtpDeliveryConfig {
  /** Registered/approved sender ID (≤11 chars). */
  senderId: string;
  /** Template with `{code}` and `{minutes}` placeholders. */
  messageTemplate: string;
  /** Code lifetime in minutes, rendered into `{minutes}` (derived from OTP_TTL_MS). */
  expiryMinutes: number;
  /** Optional provider-side tracking tags (never the code). */
  metadata?: Record<string, string>;
}

/**
 * Real OTP delivery over SMS (feature 0009). Provider-*agnostic*: it renders the
 * message, applies the sender ID, and enforces the enumeration-safe contract of
 * {@link OtpDeliveryService} — all without knowing which provider is wired. The
 * concrete transport (Vynfy first) is injected as {@link SmsProvider}, so
 * swapping providers changes nothing here.
 *
 * Enumeration-safety: `OtpService` has already persisted the challenge before
 * calling us and expects a `void` return so the controller can answer an
 * enumeration-safe `204`. We therefore **never throw** on a send failure — we
 * log and return. System-wide failures (bad key/sender, out of balance) are
 * logged at `error` with an `alert` marker for ops; per-send failures are
 * logged at `warn`. The OTP code and message body are never logged, and the
 * recipient is masked.
 */
export class SmsOtpDeliveryService extends OtpDeliveryService {
  private readonly logger = new Logger(SmsOtpDeliveryService.name);

  constructor(
    private readonly provider: SmsProvider,
    private readonly config: SmsOtpDeliveryConfig,
  ) {
    super();
  }

  async send(phone: string, code: string): Promise<void> {
    const message = this.render(code);
    try {
      const { providerMessageId } = await this.provider.sendSms({
        to: phone,
        message,
        senderId: this.config.senderId,
        metadata: this.config.metadata,
      });
      this.logger.log(
        `OTP dispatched via ${this.provider.name} to ${mask(phone)}` +
          (providerMessageId ? ` (id=${providerMessageId})` : ''),
      );
    } catch (error) {
      if (error instanceof SmsProviderError && error.isOperational) {
        // System-wide: every OTP is failing right now. Page ops — do not bury.
        this.logger.error(
          `[alert] OTP delivery is failing system-wide via ${this.provider.name}: ` +
            `${error.kind} (HTTP ${error.statusCode ?? 'n/a'}) — ${error.message}`,
        );
      } else {
        const kind = error instanceof SmsProviderError ? error.kind : 'unknown';
        this.logger.warn(
          `OTP delivery to ${mask(phone)} failed via ${this.provider.name}: ${kind}` +
            (error instanceof SmsProviderError ? ` — ${error.message}` : ''),
        );
      }
      // Swallow: preserve the enumeration-safe 204. The user can re-request
      // after the resend cooldown; the challenge row simply goes unused.
    }
  }

  /** Fill the template; the code is used here but never logged. */
  private render(code: string): string {
    return this.config.messageTemplate
      .replaceAll('{code}', code)
      .replaceAll('{minutes}', String(this.config.expiryMinutes));
  }
}

/** Mask a phone for logs: keep the country/prefix and last 3 digits. */
function mask(phone: string): string {
  if (phone.length <= 7) {
    return '***';
  }
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}
