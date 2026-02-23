import test from 'node:test';
import assert from 'node:assert/strict';
import { sortWorkoutsByRecencyDesc, workoutRecencyTimestamp } from '../utils/workoutRecency.ts';

test('workoutRecencyTimestamp prioritizes completedAt/updatedAt over date only', () => {
  const fromDateOnly = workoutRecencyTimestamp({
    date: '2026-02-01',
  });
  const fromCompletedAt = workoutRecencyTimestamp({
    date: '2026-02-01',
    completedAt: '2026-02-01T18:45:00.000Z',
  });
  assert.ok(fromCompletedAt > fromDateOnly);
});

test('sortWorkoutsByRecencyDesc sorts by timestamp recency', () => {
  const sorted = sortWorkoutsByRecencyDesc([
    { id: 'a', date: '2026-02-10', completedAt: '2026-02-10T07:00:00.000Z' },
    { id: 'b', date: '2026-02-10', completedAt: '2026-02-10T20:00:00.000Z' },
    { id: 'c', date: '2026-02-11' },
  ]);
  assert.deepEqual(
    sorted.map((w) => w.id),
    ['c', 'b', 'a']
  );
});
