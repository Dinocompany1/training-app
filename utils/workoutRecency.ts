import type { Workout } from '../context/WorkoutsContext';

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;
  return 0;
};

const dateFallbackTimestamp = (date?: string): number => {
  if (!date) return 0;
  const parsed = Date.parse(`${date}T12:00:00.000Z`);
  if (Number.isFinite(parsed)) return parsed;
  const plain = Date.parse(date);
  return Number.isFinite(plain) ? plain : 0;
};

export const workoutRecencyTimestamp = (workout: Pick<Workout, 'completedAt' | 'updatedAt' | 'createdAt' | 'date'>): number =>
  Math.max(
    toTimestamp(workout.completedAt),
    toTimestamp(workout.updatedAt),
    toTimestamp(workout.createdAt),
    dateFallbackTimestamp(workout.date)
  );

export const sortWorkoutsByRecencyDesc = <T extends Pick<Workout, 'completedAt' | 'updatedAt' | 'createdAt' | 'date'>>(
  workouts: T[]
) => [...workouts].sort((a, b) => workoutRecencyTimestamp(b) - workoutRecencyTimestamp(a));
