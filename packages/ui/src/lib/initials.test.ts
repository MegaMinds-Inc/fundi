import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials } from './initials.ts';

test('single word, multi-word, and empty names', () => {
  assert.equal(initials('Ama'), 'A');
  assert.equal(initials('Ama Mensah'), 'AM');
  assert.equal(initials('kofi owusu boateng'), 'KB');
  assert.equal(initials('   '), '?');
  assert.equal(initials(''), '?');
});
