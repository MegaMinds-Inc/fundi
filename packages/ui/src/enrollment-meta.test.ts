import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENROLLMENT_META, getEnrollmentMeta, FALLBACK_ENROLLMENT_META } from './enrollment-meta.ts';

const KNOWN_STATES = ['pending_approval', 'active', 'completed', 'dropped'] as const;

test('every known enrollment state has metadata with a Phosphor icon', () => {
  for (const key of KNOWN_STATES) {
    const meta = ENROLLMENT_META[key];
    assert.ok(meta, `missing ENROLLMENT_META for ${key}`);
    assert.ok(meta.icon.startsWith('ph-'), `icon for ${key} should be a Phosphor class`);
  }
});

test('ENROLLMENT_META has exactly the known states, no extras', () => {
  assert.deepEqual(Object.keys(ENROLLMENT_META).sort(), [...KNOWN_STATES].sort());
});

test('getEnrollmentMeta falls back to the active styling for an unknown state', () => {
  const meta = getEnrollmentMeta('not_a_state');
  assert.equal(meta, FALLBACK_ENROLLMENT_META);
  assert.equal(meta.label, 'Active');
});
