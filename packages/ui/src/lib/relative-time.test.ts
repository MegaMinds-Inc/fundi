import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from './relative-time.ts';

test('formats minutes, hours, and days with the right thresholds', () => {
  assert.equal(formatRelativeTime({ minutesAgo: 0 }), 'just now');
  assert.equal(formatRelativeTime({ minutesAgo: 5 }), '5m ago');
  assert.equal(formatRelativeTime({ minutesAgo: 59 }), '59m ago');
  assert.equal(formatRelativeTime({ hoursAgo: 1 }), '1h ago');
  assert.equal(formatRelativeTime({ hoursAgo: 23 }), '23h ago');
  assert.equal(formatRelativeTime({ hoursAgo: 24 }), '1d ago');
  assert.equal(formatRelativeTime({ hoursAgo: 49 }), '2d ago');
});

test('combines hours + minutes and clamps negatives to "just now"', () => {
  assert.equal(formatRelativeTime({ hoursAgo: 1, minutesAgo: 30 }), '1h ago');
  assert.equal(formatRelativeTime({ minutesAgo: -5 }), 'just now');
});
