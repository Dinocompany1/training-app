import test from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '../utils/id.ts';

test('createId returns non-empty id', () => {
  const id = createId();
  assert.equal(typeof id, 'string');
  assert.ok(id.length > 8);
});

test('createId applies prefix when provided', () => {
  const id = createId('workout');
  assert.ok(id.startsWith('workout-'));
});

test('createId generates unique values across many calls', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 1000; i += 1) {
    ids.add(createId('x'));
  }
  assert.equal(ids.size, 1000);
});

