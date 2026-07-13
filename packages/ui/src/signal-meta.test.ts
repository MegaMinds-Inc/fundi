import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNAL_META, getSignalMeta, FALLBACK_SIGNAL_META } from './signal-meta.ts';

// The five ADR-010 Signal types (kept as literals so this test has no runtime
// dependency on @fundi/types, whose extensionless internal imports don't resolve
// under Node ESM). Completeness against the enum is guaranteed at compile time by
// `Record<SignalType, …>` in signal-meta.ts; this file covers runtime behavior.
const KNOWN_SIGNALS = [
  'lesson_overdue',
  'reminder_unacknowledged',
  'quiz_failed',
  'help_requested',
  'went_quiet',
] as const;

test('every known Signal type has a SIGNAL_META entry with a Phosphor icon', () => {
  for (const key of KNOWN_SIGNALS) {
    const meta = SIGNAL_META[key];
    assert.ok(meta, `missing SIGNAL_META for ${key}`);
    assert.equal(typeof meta.label, 'string');
    assert.ok(meta.icon.startsWith('ph-'), `icon for ${key} should be a Phosphor class`);
  }
});

test('SIGNAL_META has exactly the known Signal keys, no extras', () => {
  assert.deepEqual(Object.keys(SIGNAL_META).sort(), [...KNOWN_SIGNALS].sort());
});

test('getSignalMeta returns the mapped entry for a known key', () => {
  assert.deepEqual(getSignalMeta('quiz_failed'), {
    label: 'Quiz failed',
    icon: 'ph-x-circle',
    tone: 'danger',
  });
});

test('getSignalMeta falls back to neutral / ph-info for an unrecognized key', () => {
  const meta = getSignalMeta('not_a_signal');
  assert.equal(meta, FALLBACK_SIGNAL_META);
  assert.equal(meta.tone, 'neutral');
  assert.equal(meta.icon, 'ph-info');
});
