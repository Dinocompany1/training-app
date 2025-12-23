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

export async function loadOngoingQuickWorkout<T = any>(): Promise<T | null> {
  try {
    const raw = await storage.getItem(ONGOING_QUICK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveOngoingQuickWorkout(snapshot: any) {
  try {
    await storage.setItem(ONGOING_QUICK_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export async function clearOngoingQuickWorkout() {
  try {
    await storage.removeItem(ONGOING_QUICK_KEY);
  } catch {
    // ignore
  }
}
