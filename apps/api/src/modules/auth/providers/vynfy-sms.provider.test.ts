import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SmsProviderError } from '../sms-provider';
import { FetchLike, VynfyConfig, VynfySmsProvider } from './vynfy-sms.provider';

/**
 * Unit test for the Vynfy adaptor (feature 0009). No network: a fake `fetch`
 * captures the request and returns a canned response, so we assert the exact
 * wire contract (`X-API-Key`, `recipients`/`sender`/`message`, E.164
 * pass-through, sandbox routing), success parsing (`task_id`), and that every
 * HTTP failure maps to the right {@link SmsProviderError} kind — without the
 * OTP code or recipient leaking into the thrown message.
 */

const BASE_CONFIG: VynfyConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://sms.vynfy.com',
  sandbox: false,
  timeoutMs: 1_000,
};

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Build a fake fetch that records the call and returns `{status, payload}`. */
function fakeFetch(status: number, payload: unknown, sink?: (c: Captured) => void): FetchLike {
  return async (url, init) => {
    sink?.({
      url,
      method: init.method,
      headers: init.headers,
      body: JSON.parse(init.body) as unknown,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    };
  };
}

const OK_BODY = {
  success: true,
  data: { recipients_count: 1, status: 'queued', task_id: 'task-123' },
  balance: { deducted: 1, remaining: 99 },
};

describe('VynfySmsProvider.sendSms', () => {
  it('POSTs the documented contract to /api/v1/send with the API key header', async () => {
    let captured: Captured | undefined;
    const provider = new VynfySmsProvider(
      BASE_CONFIG,
      fakeFetch(200, OK_BODY, (c) => (captured = c)),
    );

    const result = await provider.sendSms({
      to: '+233241234567',
      message: 'Your Fundi code is 123456. It expires in 5 min. Never share it.',
      senderId: 'Fundi',
      metadata: { purpose: 'otp' },
    });

    assert.equal(result.providerMessageId, 'task-123');
    assert.ok(captured);
    assert.equal(captured.url, 'https://sms.vynfy.com/api/v1/send');
    assert.equal(captured.method, 'POST');
    assert.equal(captured.headers['X-API-Key'], 'test-key');
    assert.equal(captured.headers['Content-Type'], 'application/json');
    assert.deepEqual(captured.body, {
      recipients: '+233241234567',
      sender: 'Fundi',
      message: 'Your Fundi code is 123456. It expires in 5 min. Never share it.',
      metadata: { purpose: 'otp' },
    });
  });

  it('routes to the sandbox path when sandbox is enabled', async () => {
    let captured: Captured | undefined;
    const provider = new VynfySmsProvider(
      { ...BASE_CONFIG, sandbox: true },
      fakeFetch(200, OK_BODY, (c) => (captured = c)),
    );

    await provider.sendSms({ to: '+233241234567', message: 'x', senderId: 'Fundi' });

    assert.equal(captured?.url, 'https://sms.vynfy.com/smssandbox/v1/send');
  });

  it('trims a trailing slash on the base URL', async () => {
    let captured: Captured | undefined;
    const provider = new VynfySmsProvider(
      { ...BASE_CONFIG, baseUrl: 'https://sms.vynfy.com/' },
      fakeFetch(200, OK_BODY, (c) => (captured = c)),
    );

    await provider.sendSms({ to: '+233241234567', message: 'x', senderId: 'Fundi' });

    assert.equal(captured?.url, 'https://sms.vynfy.com/api/v1/send');
  });

  it('omits metadata from the body when none is given', async () => {
    let captured: Captured | undefined;
    const provider = new VynfySmsProvider(
      BASE_CONFIG,
      fakeFetch(200, OK_BODY, (c) => (captured = c)),
    );

    await provider.sendSms({ to: '+233241234567', message: 'x', senderId: 'Fundi' });

    assert.deepEqual(captured?.body, {
      recipients: '+233241234567',
      sender: 'Fundi',
      message: 'x',
    });
  });

  it('treats a 2xx without success:true as a failure', async () => {
    const provider = new VynfySmsProvider(BASE_CONFIG, fakeFetch(200, { success: false }));
    await assert.rejects(
      () => provider.sendSms({ to: '+233241234567', message: 'x', senderId: 'Fundi' }),
      (e: unknown) => e instanceof SmsProviderError,
    );
  });

  const cases: { status: number; kind: string; operational: boolean }[] = [
    { status: 402, kind: 'no_balance', operational: true },
    { status: 403, kind: 'auth', operational: true },
    { status: 401, kind: 'auth', operational: true },
    { status: 400, kind: 'invalid', operational: false },
    { status: 422, kind: 'invalid', operational: false },
    { status: 429, kind: 'rate_limited', operational: false },
    { status: 500, kind: 'provider', operational: false },
  ];

  for (const { status, kind, operational } of cases) {
    it(`maps HTTP ${status} to kind '${kind}' (operational=${operational})`, async () => {
      const provider = new VynfySmsProvider(
        BASE_CONFIG,
        fakeFetch(status, { success: false, message: 'nope' }),
      );
      await assert.rejects(
        () => provider.sendSms({ to: '+233241234567', message: 'secret', senderId: 'Fundi' }),
        (e: unknown) => {
          assert.ok(e instanceof SmsProviderError);
          assert.equal(e.kind, kind);
          assert.equal(e.isOperational, operational);
          assert.equal(e.statusCode, status);
          // The OTP-bearing message body must never leak into the error.
          assert.ok(!e.message.includes('secret'));
          return true;
        },
      );
    });
  }

  it('classifies a transport failure (no response) as network', async () => {
    const provider = new VynfySmsProvider(BASE_CONFIG, async () => {
      throw new Error('connection reset');
    });
    await assert.rejects(
      () => provider.sendSms({ to: '+233241234567', message: 'x', senderId: 'Fundi' }),
      (e: unknown) => e instanceof SmsProviderError && e.kind === 'network',
    );
  });

  it('classifies an empty/non-JSON error body without throwing on parse', async () => {
    const provider = new VynfySmsProvider(BASE_CONFIG, async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    }));
    await assert.rejects(
      () => provider.sendSms({ to: '+233241234567', message: 'x', senderId: 'Fundi' }),
      (e: unknown) => e instanceof SmsProviderError && e.kind === 'provider',
    );
  });
});
