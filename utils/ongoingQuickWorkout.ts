// Enkel lagring av pågående snabbpass med fallback om async-storage inte finns
const memoryStore = new Map<string, string>();

type Storage = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

let storage: Storage = {
  getItem: async (key: string) => memoryStore.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStore.delete(key);
  },
};

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  storage = require('@react-native-async-storage/async-storage').default;
} catch {
  // fallback i minnet
}

export const ONGOING_QUICK_KEY = 'ongoing-quick-workout';

export type OngoingQuickWorkoutSet = {
  id: string;
  reps: string;
  weight: string;
  done?: boolean;
};

export type OngoingQuickWorkoutExercise = {
  id: string;
  name: string;
  muscleGroup?: string;
  sets: OngoingQuickWorkoutSet[];
};

export type OngoingQuickWorkoutSnapshot = {
  title: string;
  color: string;
  notes?: string;
  exercises: OngoingQuickWorkoutExercise[];
  showDetails?: boolean;
  templateId?: string;
  plannedId?: string;
  startTimestamp?: number;
};

export const isOngoingSnapshot = (value: unknown): value is OngoingQuickWorkoutSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.title !== 'string') return false;
  if (!Array.isArray(obj.exercises)) return false;
  return true;
};

export async function loadOngoingQuickWorkout<T = OngoingQuickWorkoutSnapshot>(): Promise<T | null> {
  try {
    const raw = await storage.getItem(ONGOING_QUICK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isOngoingSnapshot(parsed)) {
      console.warn('Invalid ongoing quick workout snapshot, ignoring stored value');
      return null;
    }
    return parsed as T;
  } catch (err) {
    console.warn('Failed to load ongoing quick workout snapshot', err);
    return null;
  }
}

export async function saveOngoingQuickWorkout(snapshot: OngoingQuickWorkoutSnapshot) {
  try {
    await storage.setItem(ONGOING_QUICK_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('Failed to save ongoing quick workout snapshot', err);
  }
}

export async function clearOngoingQuickWorkout() {
  try {
    await storage.removeItem(ONGOING_QUICK_KEY);
  } catch (err) {
    console.warn('Failed to clear ongoing quick workout snapshot', err);
  }
}
