/**
 * Provider-agnostic SMS transport seam (feature 0009). `SmsOtpDeliveryService`
 * depends on this token, never on a concrete provider — so switching from Vynfy
 * to Twilio/Arkesel/Hubtel later is one new implementation class plus one
 * registry entry, with no change to the OTP lifecycle, the delivery service, or
 * anything above the {@link OtpDeliveryService} seam.
 */

/**
 * Coarse, provider-independent classification of a send failure. Lets the
 * delivery service decide *policy* (swallow-and-continue vs. page ops) without
 * knowing any provider's status-code dialect.
 */
export type SmsFailureKind =
  | 'auth' // bad API key / unapproved sender ID — a deploy-level misconfig
  | 'no_balance' // out of SMS credit — a system-wide outage, not per-recipient
  | 'invalid' // malformed request / validation rejected (e.g. 400/422)
  | 'rate_limited' // the provider throttled us (e.g. 429)
  | 'provider' // upstream 5xx / unexpected provider error
  | 'network'; // timeout or transport failure — no HTTP response arrived

/**
 * The one error type every provider throws. Carries a provider-independent
 * {@link SmsFailureKind} so callers branch on `kind`, not on raw HTTP codes.
 * The message must never contain the recipient or the message body (the body
 * carries the OTP; the recipient enables enumeration).
 */
export class SmsProviderError extends Error {
  constructor(
    readonly kind: SmsFailureKind,
    message: string,
    readonly provider: string,
    readonly statusCode?: number,
    readonly reason?: unknown,
  ) {
    super(message);
    this.name = 'SmsProviderError';
  }

  /**
   * True when the failure is system-wide (affects every recipient) rather than
   * specific to one send — the signal for the delivery service to alert ops.
   */
  get isOperational(): boolean {
    return this.kind === 'auth' || this.kind === 'no_balance';
  }
}

/** A single SMS to dispatch. `to` is already canonical E.164 (PhoneService). */
export interface SendSmsInput {
  /** Canonical E.164 recipient — already normalised upstream. */
  to: string;
  /** Fully-rendered message body (kept ≤160 chars for one SMS segment). */
  message: string;
  /** Registered/approved sender ID (≤11 chars). */
  senderId: string;
  /** Optional provider-side tracking tags (never carries the OTP code). */
  metadata?: Record<string, string>;
}

/** What a successful send yields — just enough to correlate later. */
export interface SendSmsResult {
  /** The provider's message/task id, if it returns one (for logs/receipts). */
  providerMessageId?: string;
}

/**
 * The single method any SMS provider must implement. Resolves once the provider
 * has ACCEPTED the message for delivery; throws {@link SmsProviderError} on any
 * failure. Implementations must never log the message body. Declared abstract so
 * it doubles as the Nest DI token.
 */
export abstract class SmsProvider {
  /** Stable provider slug (e.g. `vynfy`) — used in logs/metadata only. */
  abstract readonly name: string;
  abstract sendSms(input: SendSmsInput): Promise<SendSmsResult>;
}
