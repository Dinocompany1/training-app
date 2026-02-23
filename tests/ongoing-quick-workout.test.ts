import test from 'node:test';
import assert from 'node:assert/strict';
import { isOngoingSnapshot } from '../utils/ongoingQuickWorkout.ts';

test('isOngoingSnapshot returns true for valid snapshot shape', () => {
  const snapshot = {
    title: 'Push',
    color: '#3b82f6',
    exercises: [
      {
        id: 'a',
        name: 'Bench press',
        sets: [{ id: 's1', reps: '8-10', weight: '80' }],
      },
    ],
  };
  assert.equal(isOngoingSnapshot(snapshot), true);
});

test('isOngoingSnapshot returns false for invalid payloads', () => {
  assert.equal(isOngoingSnapshot(null), false);
  assert.equal(isOngoingSnapshot({ title: 'Push' }), false);
  assert.equal(isOngoingSnapshot({ title: 123, exercises: [] }), false);
});

