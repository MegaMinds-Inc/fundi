import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SmsOtpDeliveryService } from './sms-otp-delivery.service';
import {
  SendSmsInput,
  SendSmsResult,
  SmsFailureKind,
  SmsProvider,
  SmsProviderError,
} from './sms-provider';

/**
 * Unit test for the provider-agnostic OTP delivery service (feature 0009). It
 * verifies the two things this layer owns: (1) the message template is rendered
 * with the code + expiry and handed to the provider with the sender ID, and
 * (2) the enumeration-safe contract — a provider failure is swallowed (never
 * thrown) so `OtpService` can still answer an enumeration-safe 204.
 */

const CONFIG = {
  senderId: 'Fundi',
  messageTemplate: 'Your Fundi code is {code}. It expires in {minutes} min.',
  expiryMinutes: 5,
  metadata: { purpose: 'otp' },
};

/** Provider fake that records the last send or throws a chosen failure. */
class FakeProvider extends SmsProvider {
  readonly name = 'fake';
  last?: SendSmsInput;
  constructor(private readonly failWith?: SmsFailureKind) {
    super();
  }
  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    this.last = input;
    if (this.failWith) {
      throw new SmsProviderError(this.failWith, 'boom', this.name, 500);
    }
    return { providerMessageId: 'id-1' };
  }
}

describe('SmsOtpDeliveryService.send', () => {
  it('renders the template and forwards sender ID + metadata to the provider', async () => {
    const provider = new FakeProvider();
    const svc = new SmsOtpDeliveryService(provider, CONFIG);

    await svc.send('+233241234567', '123456');

    assert.deepEqual(provider.last, {
      to: '+233241234567',
      message: 'Your Fundi code is 123456. It expires in 5 min.',
      senderId: 'Fundi',
      metadata: { purpose: 'otp' },
    });
  });

  it('swallows a per-send provider failure (enumeration-safe — never throws)', async () => {
    const svc = new SmsOtpDeliveryService(new FakeProvider('invalid'), CONFIG);
    await assert.doesNotReject(() => svc.send('+233241234567', '123456'));
  });

  it('swallows an operational failure too (does not throw), so the 204 holds', async () => {
    const svc = new SmsOtpDeliveryService(new FakeProvider('no_balance'), CONFIG);
    await assert.doesNotReject(() => svc.send('+233241234567', '123456'));
  });
});
