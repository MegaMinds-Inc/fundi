import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { PhoneService } from './phone.service';

/**
 * Pure unit test (no DB) for phone normalisation — the C.5 phone-normalisation
 * matrix: every local/international form of one human must collapse to a single
 * canonical E.164 `Account.phone`, and garbage must fail loudly rather than
 * mint a junk identity. Default region is GH (+233).
 */
describe('PhoneService.normalize', () => {
  const svc = new PhoneService();
  const CANONICAL = '+233241234567';

  it('normalizes a local leading-0 Ghana number to E.164', () => {
    assert.equal(svc.normalize('0241234567'), CANONICAL);
  });

  it('normalizes a spaced local Ghana number to E.164', () => {
    assert.equal(svc.normalize('024 123 4567'), CANONICAL);
  });

  it('leaves an already-E.164 Ghana number unchanged', () => {
    assert.equal(svc.normalize('+233241234567'), CANONICAL);
  });

  it('collapses all forms of the same human onto ONE canonical identity', () => {
    const forms = ['0241234567', '024 123 4567', '+233241234567', '+233 24 123 4567'];
    const canonicals = new Set(forms.map((f) => svc.normalize(f)));
    assert.equal(canonicals.size, 1, 'every form must resolve to a single E.164 identity');
    assert.equal([...canonicals][0], CANONICAL);
  });

  it('does not force GH onto an explicit international number', () => {
    // A US number given in full E.164 must stay US, not be re-homed to GH.
    assert.equal(svc.normalize('+14155552671'), '+14155552671');
  });

  it('rejects an empty input', () => {
    assert.throws(
      () => svc.normalize('   '),
      (e: unknown) => e instanceof BadRequestException,
    );
  });

  it('rejects a non-number', () => {
    assert.throws(
      () => svc.normalize('not-a-phone'),
      (e: unknown) => e instanceof BadRequestException,
    );
  });

  it('rejects a too-short number that cannot be a real phone', () => {
    assert.throws(
      () => svc.normalize('12345'),
      (e: unknown) => e instanceof BadRequestException,
    );
  });
});
