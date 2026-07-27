import { BadRequestException, Injectable } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { DEFAULT_PHONE_REGION } from './auth.constants';

/**
 * Canonicalises phone input to E.164, the single identity key for `Account`
 * (`phone @unique`). The UI accepts a friendly local format (`080 123 4567`);
 * normalisation happens here, server-side, so `08012345678` and `+233…` forms
 * for the same human resolve to one canonical Account and can never split into
 * two identities (QA C.5 phone-normalisation matrix).
 */
@Injectable()
export class PhoneService {
  /**
   * Parse `input` (local or international) and return its E.164 form. Throws
   * `BadRequestException` if the number is not a valid, dialable phone number
   * in {@link DEFAULT_PHONE_REGION} context — a mistyped number must fail here
   * rather than mint a garbage Account.
   */
  normalize(input: string): string {
    const trimmed = (input ?? '').trim();
    if (trimmed.length === 0) {
      throw new BadRequestException({
        code: 'phone_invalid',
        message: 'Phone number is required.',
      });
    }
    const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_PHONE_REGION);
    if (!parsed || !parsed.isValid()) {
      throw new BadRequestException({
        code: 'phone_invalid',
        message: 'Enter a valid phone number, e.g. 020 123 4567.',
      });
    }
    return parsed.number;
  }
}
