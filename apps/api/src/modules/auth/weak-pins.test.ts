import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isWeakPin } from './weak-pins';

/**
 * Pure unit test for the weak-PIN blocklist (feature 0010 §7.3). No DB, no
 * crypto — just the structural classifier the server and client share.
 */
describe('isWeakPin — blocklist (0010 §7.3)', () => {
  it('rejects all-same-digit PINs', () => {
    for (const p of ['000000', '111111', '999999', '555555']) {
      assert.equal(isWeakPin(p), true, `${p} must be weak`);
    }
  });

  it('rejects ascending and descending runs (incl. mod-10 wrap)', () => {
    for (const p of ['123456', '234567', '567890', '654321', '987654', '210987']) {
      assert.equal(isWeakPin(p), true, `${p} must be weak`);
    }
  });

  it('rejects repeated 2- and 3-digit units', () => {
    for (const p of ['121212', '454545', '123123', '456456', '787878']) {
      assert.equal(isWeakPin(p), true, `${p} must be weak`);
    }
  });

  it('rejects hot-list common PINs', () => {
    for (const p of ['123456', '696969', '112233', '159753', '147258', '123321']) {
      assert.equal(isWeakPin(p), true, `${p} must be weak`);
    }
  });

  it('rejects year / date patterns', () => {
    for (const p of ['199012', '201599', '010190', '120599']) {
      assert.equal(isWeakPin(p), true, `${p} must be weak`);
    }
  });

  it('rejects non-digit input outright', () => {
    assert.equal(isWeakPin('12a456'), true);
    assert.equal(isWeakPin(''), true);
  });

  it('accepts structurally-strong PINs', () => {
    for (const p of ['284659', '703928', '486207', '905172']) {
      assert.equal(isWeakPin(p), false, `${p} should be allowed`);
    }
  });
});
