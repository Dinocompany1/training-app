import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepsValue } from '../utils/reps.ts';

test('parseRepsValue handles single rep number', () => {
  assert.equal(parseRepsValue('10'), 10);
});

test('parseRepsValue handles intervals with hyphen and en dash', () => {
  assert.equal(parseRepsValue('8-10'), 9);
  assert.equal(parseRepsValue('8–10'), 9);
});

test('parseRepsValue ignores invalid input gracefully', () => {
  assert.equal(parseRepsValue('abc'), 0);
  assert.equal(parseRepsValue(''), 0);
});

