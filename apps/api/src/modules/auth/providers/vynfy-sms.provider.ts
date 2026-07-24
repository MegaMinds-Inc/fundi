import {
  SendSmsInput,
  SendSmsResult,
  SmsFailureKind,
  SmsProvider,
  SmsProviderError,
} from '../sms-provider';

/**
 * Runtime config for the Vynfy adaptor. Assembled by the auth module's provider
 * factory from env (feature 0009 §5); the provider itself reads no `process.env`
 * so it stays trivially unit-testable with injected values.
 */
export interface VynfyConfig {
  /** `X-API-Key` secret. */
  apiKey: string;
  /** API root, e.g. `https://sms.vynfy.com` (no trailing slash required). */
  baseUrl: string;
  /** When true, route to the sandbox path (accepted but never delivered). */
  sandbox: boolean;
  /** Abort the HTTP call after this many ms (no auto-retry — see below). */
  timeoutMs: number;
}

/** Narrow `fetch` to just what we use, so tests can pass a tiny fake. */
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const PROVIDER = 'vynfy';
const LIVE_PATH = '/api/v1/send';
const SANDBOX_PATH = '/smssandbox/v1/send';

/**
 * Vynfy SMS adaptor over `POST /api/v1/send` (feature 0009 §4). This is the
 * plain transactional-SMS path: the OTP code is generated, hashed, and verified
 * entirely by our own `OtpService` — Vynfy only carries the rendered text. We
 * deliberately do **not** use Vynfy's managed `/otp/*` endpoints (that would
 * cede the code lifecycle and lock us to one provider; see the 0009 plan).
 *
 * Contract (from the live spec at `https://sms.vynfy.com/api/v1/docs`, v1.0):
 *   headers  `X-API-Key`, `Content-Type: application/json`
 *   body     `{ recipients, sender, message, metadata? }`
 *   success  `200` with `{ success: true, data: { task_id, ... } }`
 *   errors   402 no-balance · 401/403 auth · 400/422 invalid · 429 throttled · 5xx
 *
 * No auto-retry: `OtpService` already enforces a resend cooldown + rolling cap,
 * so a blind retry would risk double-charging and double-texting. A single
 * network failure surfaces as a `network` {@link SmsProviderError} for the
 * delivery layer to log and swallow (the user can re-request after the cooldown).
 */
export class VynfySmsProvider extends SmsProvider {
  readonly name = PROVIDER;

  constructor(
    private readonly config: VynfyConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  ) {
    super();
  }

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    const path = this.config.sandbox ? SANDBOX_PATH : LIVE_PATH;
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${path}`;
    const body = JSON.stringify({
      recipients: input.to,
      sender: input.senderId,
      message: input.message,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let status: number;
    let ok: boolean;
    let payload: unknown;
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      status = response.status;
      ok = response.ok;
      payload = await this.readJson(response);
    } catch (reason) {
      // Timeout (abort) or transport failure — no HTTP response to classify.
      throw new SmsProviderError(
        'network',
        'Vynfy request failed before a response was received.',
        PROVIDER,
        undefined,
        reason,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!ok || !this.isAccepted(payload)) {
      throw new SmsProviderError(
        classify(status),
        // Detail only — never the recipient or the body (enumeration/secret safe).
        `Vynfy rejected the send (HTTP ${status}): ${extractMessage(payload, status)}`,
        PROVIDER,
        status,
      );
    }

    return { providerMessageId: extractTaskId(payload) };
  }

  private async readJson(response: { json: () => Promise<unknown> }): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      // Empty or non-JSON body (some error responses) — treat as no payload.
      return undefined;
    }
  }

  /** Vynfy signals logical success with `success: true` on a 2xx. */
  private isAccepted(payload: unknown): boolean {
    return isRecord(payload) && payload.success === true;
  }
}

/** Map Vynfy's HTTP status onto the provider-independent failure taxonomy. */
function classify(status: number): SmsFailureKind {
  switch (status) {
    case 401:
    case 403:
      return 'auth';
    case 402:
      return 'no_balance';
    case 400:
    case 422:
      return 'invalid';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'provider' : 'invalid';
  }
}

function extractMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const msg = payload.message ?? payload.error;
    if (typeof msg === 'string' && msg.length > 0) {
      return msg;
    }
  }
  return `HTTP ${status}`;
}

function extractTaskId(payload: unknown): string | undefined {
  if (isRecord(payload) && isRecord(payload.data)) {
    const id = payload.data.task_id;
    if (typeof id === 'string') {
      return id;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
