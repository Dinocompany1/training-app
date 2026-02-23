// context/WorkoutsContext.tsx
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  useCallback,
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from '../utils/toast';
import { supabase } from '../utils/supabaseClient';

export interface PerformedSet {
  reps: string;
  weight: number;
  done?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;          // t.ex. "8–10"
  weight: number;        // 0 om ej angivet
  muscleGroup?: string;
  performedSets?: PerformedSet[];
}

export interface Workout {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD
  createdAt?: string;    // ISO datetime
  updatedAt?: string;    // ISO datetime
  completedAt?: string;  // ISO datetime
  notes?: string;
  exercises?: Exercise[];
  color?: string;        // färg för passet (push/pull/ben)
  durationMinutes?: number;
  isCompleted?: boolean;
  sourceTemplateId?: string;
}

export interface TemplateExercise {
  name: string;
  sets: number;
  reps: string;
  weight: number;
  muscleGroup?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  color: string;
  exercises: TemplateExercise[];
}

export interface BodyPhoto {
  id: string;
  uri: string;
  date: string;          // YYYY-MM-DD
  note?: string;
}

export interface CustomExercise {
  name: string;
  muscleGroup: string;
  imageUri?: string;
}

interface WorkoutsContextValue {
  // Loggade pass
  workouts: Workout[];
  addWorkout: (workout: Workout) => void;
  updateWorkout: (workout: Workout) => void;
  removeWorkout: (id: string) => void;
  forceSave?: (override?: PersistedData['data']) => Promise<void>;

  // Sparade rutiner
  templates: Template[];
  addTemplate: (template: Template) => void;
  updateTemplate: (template: Template) => void;
  removeTemplate: (id: string) => void;

  // Kropps-progressbilder
  bodyPhotos: BodyPhoto[];
  addBodyPhoto: (photo: BodyPhoto) => void;
  removeBodyPhoto: (id: string) => void;

  // Egna övningar
  customExercises: CustomExercise[];
  addCustomExercise: (ex: CustomExercise) => void;
  removeCustomExercise: (name: string, muscleGroup: string) => void;
  customGroups: string[];
  addCustomGroup: (name: string) => void;
  removeCustomGroup: (name: string) => void;

  // Veckomål
  weeklyGoal: number;
  setWeeklyGoal: (goal: number) => void;

  // Export / backup
  exportData: () => Promise<string | null>;
  syncStatus: 'idle' | 'saving' | 'error';
  lastSyncedAt: string | null;
  syncErrorMessage: string | null;
  cloudSyncStatus: 'off' | 'inactive' | 'active' | 'error';
}

const WorkoutsContext = createContext<WorkoutsContextValue | undefined>(
  undefined
);

const FS_DOCUMENT_DIR = (FileSystem as any).documentDirectory ?? '';
const STORAGE_PATH = `${FS_DOCUMENT_DIR}workouts-data.json`;
const BACKUP_DIR = `${FS_DOCUMENT_DIR}backups`;
const DATA_VERSION = 1;
const ASYNC_KEY = 'workouts-data';
type PersistedData = {
  version: number;
  updatedAt?: string;
  data: {
    workouts: Workout[];
    templates: Template[];
    bodyPhotos: BodyPhoto[];
    weeklyGoal: number;
    customExercises?: CustomExercise[];
    customGroups?: string[];
  };
};
type StorageAdapter = {
  load: () => Promise<PersistedData | null>;
  save: (payload: PersistedData) => Promise<void>;
  exportData: (payload: PersistedData) => Promise<string | null>;
};
const CLOUD_ROW_SUFFIX = 'app-state';

const toIsoFallbackFromDate = (date?: string): string => {
  if (!date) return new Date(0).toISOString();
  const direct = Date.parse(`${date}T12:00:00.000Z`);
  if (Number.isFinite(direct)) return new Date(direct).toISOString();
  const plain = Date.parse(date);
  if (Number.isFinite(plain)) return new Date(plain).toISOString();
  return new Date(0).toISOString();
};

const isValidIsoTimestamp = (value?: string): boolean =>
  Boolean(value && Number.isFinite(Date.parse(value)));

const workoutTimestampMs = (workout: Workout): number => {
  const candidates = [workout.completedAt, workout.updatedAt, workout.createdAt]
    .map((value) => (value ? Date.parse(value) : NaN))
    .filter((value) => Number.isFinite(value)) as number[];
  if (candidates.length > 0) return Math.max(...candidates);
  return Date.parse(toIsoFallbackFromDate(workout.date));
};

const derivePayloadUpdatedAt = (payload: PersistedData): string => {
  const latestWorkoutTs = (payload.data.workouts || []).reduce((max, workout) => {
    const ts = workoutTimestampMs(workout);
    return ts > max ? ts : max;
  }, 0);
  return new Date(latestWorkoutTs || Date.now()).toISOString();
};

const withUpdatedAt = (payload: PersistedData, options?: { touch?: boolean }): PersistedData => {
  const updatedAt = options?.touch
    ? new Date().toISOString()
    : isValidIsoTimestamp(payload.updatedAt)
      ? payload.updatedAt
      : derivePayloadUpdatedAt(payload);
  return {
    ...payload,
    updatedAt,
  };
};

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [bodyPhotos, setBodyPhotos] = useState<BodyPhoto[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(3);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'off' | 'inactive' | 'active' | 'error'>(
    supabase ? 'inactive' : 'off'
  );
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSkippedInitialAutosave = useRef(false);

  // ===== Pass =====
  const addWorkout = (workout: Workout) => {
    const now = new Date().toISOString();
    setWorkouts((prev) => [
      ...prev,
      {
        ...workout,
        createdAt: workout.createdAt || now,
        updatedAt: now,
        completedAt: workout.isCompleted ? workout.completedAt || now : workout.completedAt,
      },
    ]);
  };

  const updateWorkout = (workout: Workout) => {
    const now = new Date().toISOString();
    setWorkouts((prev) =>
      prev.map((w) => {
        if (w.id !== workout.id) return w;
        return {
          ...workout,
          createdAt: workout.createdAt || w.createdAt || now,
          updatedAt: now,
          completedAt:
            workout.isCompleted
              ? workout.completedAt || w.completedAt || now
              : workout.completedAt || w.completedAt,
        };
      })
    );
  };

  const removeWorkout = (id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  // ===== Rutiner =====
  const addTemplate = (template: Template) => {
    setTemplates((prev) => [...prev, template]);
  };

  const updateTemplate = (template: Template) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? template : t))
    );
  };

  const removeTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // ===== Kropps-bilder =====
  const addBodyPhoto = (photo: BodyPhoto) => {
    setBodyPhotos((prev) => [...prev, photo]);
  };

  const removeBodyPhoto = (id: string) => {
    setBodyPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // ===== Egna övningar =====
  const addCustomExercise = (ex: CustomExercise) => {
    setCustomExercises((prev) => {
      const exists = prev.some(
        (p) =>
          p.name.toLowerCase() === ex.name.toLowerCase() &&
          p.muscleGroup.toLowerCase() === ex.muscleGroup.toLowerCase()
      );
      if (exists) return prev;
      return [...prev, ex];
    });
    setCustomGroups((prev) =>
      prev.includes(ex.muscleGroup) ? prev : [...prev, ex.muscleGroup]
    );
  };
  const removeCustomExercise = (name: string, muscleGroup: string) => {
    setCustomExercises((prev) =>
      prev.filter(
        (p) =>
          !(
            p.name.toLowerCase() === name.toLowerCase() &&
            p.muscleGroup.toLowerCase() === muscleGroup.toLowerCase()
          )
      )
    );
  };
  const addCustomGroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomGroups((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };
  const removeCustomGroup = (name: string) => {
    setCustomGroups((prev) => prev.filter((g) => g !== name));
    setCustomExercises((prev) =>
      prev.filter((ex) => ex.muscleGroup !== name)
    );
  };

  // ===== Persistensadapter (FileSystem) =====
  const fileStorageAdapter: StorageAdapter = useMemo(
    () => ({
      load: async () => {
        try {
          const info = await FileSystem.getInfoAsync(STORAGE_PATH);
          if (!info.exists) return null;
          const content = await FileSystem.readAsStringAsync(STORAGE_PATH);
          const parsed = JSON.parse(content) as PersistedData | any;
          if (!parsed) return null;
          if (parsed.data) return withUpdatedAt(parsed as PersistedData);
          // fallback om ingen wrapper
          return withUpdatedAt({
            version: 0,
            data: {
              workouts: parsed.workouts || [],
              templates: parsed.templates || [],
              bodyPhotos: parsed.bodyPhotos || [],
              weeklyGoal: parsed.weeklyGoal ?? 3,
            },
          });
        } catch (err) {
          console.warn('Kunde inte läsa träningsdata', err);
          try {
            const backupInfo = await FileSystem.getInfoAsync(
              `${BACKUP_DIR}/latest-backup.json`
            );
            if (!backupInfo.exists) return null;
            const backupContent = await FileSystem.readAsStringAsync(
              `${BACKUP_DIR}/latest-backup.json`
            );
            return withUpdatedAt(JSON.parse(backupContent) as PersistedData);
          } catch (backupErr) {
            console.warn('Kunde inte läsa backup-data', backupErr);
            return null;
          }
        }
      },
      save: async (payload: PersistedData) => {
        const hydratedPayload = withUpdatedAt(payload);
        const json = JSON.stringify(hydratedPayload);
        await FileSystem.makeDirectoryAsync(BACKUP_DIR, {
          intermediates: true,
        });
        await FileSystem.writeAsStringAsync(STORAGE_PATH, json);
        await FileSystem.writeAsStringAsync(
          `${BACKUP_DIR}/latest-backup.json`,
          json
        );
      },
      exportData: async (payload: PersistedData) => {
        try {
          const json = JSON.stringify(payload, null, 2);
          await FileSystem.makeDirectoryAsync(BACKUP_DIR, {
            intermediates: true,
          });
          const filename = `${BACKUP_DIR}/backup-${Date.now()}.json`;
          await FileSystem.writeAsStringAsync(filename, json);
          return filename;
        } catch (err) {
          console.warn('Kunde inte exportera träningsdata', err);
          return null;
        }
      },
    }),
    []
  );

const asyncStorageAdapter: StorageAdapter = useMemo(
    () => ({
      load: async () => {
        try {
          const raw = await AsyncStorage.getItem(ASYNC_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw) as PersistedData | any;
          if (!parsed) return null;
          if (parsed.data) return withUpdatedAt(parsed as PersistedData);
          return withUpdatedAt({
            version: 0,
            data: {
              workouts: parsed.workouts || [],
              templates: parsed.templates || [],
              bodyPhotos: parsed.bodyPhotos || [],
              weeklyGoal: parsed.weeklyGoal ?? 3,
              customExercises: parsed.customExercises || [],
              customGroups: parsed.customGroups || [],
            },
          });
        } catch (err) {
          console.warn('AsyncStorage load fail', err);
          return null;
        }
      },
      save: async (payload: PersistedData) => {
        try {
          await AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(withUpdatedAt(payload)));
        } catch (err) {
          throw err;
        }
      },
      exportData: async (payload: PersistedData) =>
        JSON.stringify(withUpdatedAt(payload).data, null, 2),
    }),
    []
  );

  const supabaseStorageAdapter: StorageAdapter | null = useMemo(() => {
    const sb = supabase;
    if (!sb) return null;
    const getCloudRowId = async () => {
      const { data, error } = await sb.auth.getUser();
      if (error) {
        console.warn('Supabase auth error', error);
        setCloudSyncStatus('error');
        return null;
      }
      const uid = data.user?.id;
      if (!uid) {
        setCloudSyncStatus('inactive');
        return null;
      }
      setCloudSyncStatus('active');
      return `${uid}:${CLOUD_ROW_SUFFIX}`;
    };
    return {
      load: async () => {
        const rowId = await getCloudRowId();
        if (!rowId) return null;
        const { data, error } = await sb
          .from('app_state')
          .select('version,data')
          .eq('id', rowId)
          .maybeSingle();
        if (error) {
          console.warn('Supabase load error', error);
          setCloudSyncStatus('error');
          return null;
        }
        if (!data) return null;
        const cloudPayload = data.data;
        if (cloudPayload && typeof cloudPayload === 'object' && 'data' in cloudPayload) {
          return withUpdatedAt(cloudPayload as PersistedData);
        }
        return withUpdatedAt({
          version: data.version ?? 0,
          data: (cloudPayload || {}) as PersistedData['data'],
        });
      },
      save: async (payload: PersistedData) => {
        const hydratedPayload = withUpdatedAt(payload);
        const rowId = await getCloudRowId();
        if (!rowId) return;
        const { error } = await sb
          .from('app_state')
          .upsert({
            id: rowId,
            version: hydratedPayload.version,
            data: hydratedPayload,
          });
        if (error) {
          setCloudSyncStatus('error');
          throw error;
        }
      },
      exportData: async (payload: PersistedData) =>
        JSON.stringify(withUpdatedAt(payload).data, null, 2),
    };
  }, []);

  // primär adapter = AsyncStorage (snabb). sekundär = fil för backup. tredje = supabase om den finns.
  const primaryAdapter: StorageAdapter = asyncStorageAdapter;
  const secondaryAdapter: StorageAdapter | null = fileStorageAdapter;
  const cloudAdapter: StorageAdapter | null = supabaseStorageAdapter;
  const activeAdapters = useMemo(
    () => [primaryAdapter, secondaryAdapter, cloudAdapter].filter(Boolean) as StorageAdapter[],
    [primaryAdapter, secondaryAdapter, cloudAdapter]
  );

  const saveToAdapters = useCallback(
    async (payload: PersistedData, options?: { silent?: boolean }) => {
      if (!options?.silent) setSyncStatus('saving');
      const hydratedPayload = withUpdatedAt(payload, { touch: true });
      const results = await Promise.allSettled(
        activeAdapters.map((adapter) => adapter.save(hydratedPayload))
      );
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length > 0) {
        const firstReason = failures[0]?.reason;
        const reasonText =
          firstReason instanceof Error ? firstReason.message : String(firstReason || '');
        setSyncStatus('error');
        setSyncErrorMessage(reasonText || 'Unknown sync error');
        return;
      }
      setSyncStatus('idle');
      setSyncErrorMessage(null);
      setLastSyncedAt(new Date().toISOString());
    },
    [activeAdapters]
  );

  const migrateData = (data: PersistedData['data']): PersistedData['data'] => {
    const normalizeMuscle = (mg?: string) => {
      if (!mg) return 'Övrigt';
      const trimmed = mg.trim();
      if (!trimmed) return 'Övrigt';
      if (trimmed.toLowerCase() === 'okänd') return 'Övrigt';
      return trimmed;
    };
    const normalizeReps = (r: string) => (r && r.trim().length > 0 ? r : '0');
    const normalizeWeight = (w: number) => (Number.isFinite(w) && w >= 0 ? Math.round(w * 100) / 100 : 0);
    const sanitizePerformedSets = (sets?: PerformedSet[]) =>
      (sets || []).map((ps) => ({
        reps: normalizeReps(ps.reps),
        weight: normalizeWeight(ps.weight),
        done: !!ps.done,
      }));
    const sanitizeExercises = (list?: Exercise[]) =>
      (list || [])
        .map((ex) => ({
          ...ex,
          muscleGroup: normalizeMuscle(ex.muscleGroup),
          reps: normalizeReps(ex.reps),
          weight: normalizeWeight(ex.weight),
          performedSets: sanitizePerformedSets(ex.performedSets),
        }))
        .filter((ex) => !!ex.name);
    const sanitizeCustomExercises = (list?: CustomExercise[]) =>
      (list || [])
        .map((ex) => ({
          name: ex.name?.trim() || '',
          muscleGroup: normalizeMuscle(ex.muscleGroup),
          imageUri: ex.imageUri,
        }))
        .filter((ex) => !!ex.name);
    const cleanWorkouts = (data.workouts || []).map((w) => {
      const fallbackTimestamp = toIsoFallbackFromDate(w.date);
      const createdAt = w.createdAt || fallbackTimestamp;
      const updatedAt = w.updatedAt || w.completedAt || createdAt;
      const completedAt = w.isCompleted ? w.completedAt || updatedAt : w.completedAt;
      return {
        ...w,
        createdAt,
        updatedAt,
        completedAt,
        exercises: sanitizeExercises(w.exercises),
      };
    });
    const cleanTemplates = (data.templates || []).map((t) => ({
      ...t,
      exercises: sanitizeExercises(t.exercises as any),
    }));
    return {
      workouts: cleanWorkouts,
      templates: cleanTemplates,
      bodyPhotos: data.bodyPhotos || [],
      weeklyGoal: data.weeklyGoal ?? 3,
      customExercises: sanitizeCustomExercises(data.customExercises),
      customGroups: Array.from(
        new Set([
          ...(data.customGroups || []),
          ...sanitizeCustomExercises(data.customExercises).map((ex) => ex.muscleGroup),
        ])
      ),
    };
  };

  // Ladda
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const candidates: PersistedData[] = [];
      try {
        const fromPrimary = await primaryAdapter.load();
        if (fromPrimary) candidates.push(withUpdatedAt(fromPrimary));
      } catch (err) {
        console.warn('Load primary failed', err);
      }
      if (secondaryAdapter) {
        try {
          const fromSecondary = await secondaryAdapter.load();
          if (fromSecondary) candidates.push(withUpdatedAt(fromSecondary));
        } catch (err) {
          console.warn('Load secondary failed', err);
        }
      }
      if (cloudAdapter) {
        try {
          const fromCloud = await cloudAdapter.load();
          if (fromCloud) candidates.push(withUpdatedAt(fromCloud));
        } catch (err) {
          console.warn('Load cloud failed', err);
        }
      }
      const persisted =
        candidates.length > 0
          ? candidates.sort((a, b) => Date.parse(derivePayloadUpdatedAt(b)) - Date.parse(derivePayloadUpdatedAt(a)))[0]
          : null;

      if (!persisted) {
        if (isMounted) setLoaded(true);
        return;
      }

      try {
        const migrated = migrateData(persisted.data);
        setWorkouts(migrated.workouts);
        setTemplates(migrated.templates);
        setBodyPhotos(migrated.bodyPhotos);
        setWeeklyGoal(migrated.weeklyGoal);
        setCustomExercises(migrated.customExercises || []);
        setCustomGroups(migrated.customGroups || []);
        // skriv tillbaka migrerat innehåll så filen är ren inför framtida laddningar
        const payload: PersistedData = withUpdatedAt({
          version: DATA_VERSION,
          data: migrated,
        });
        await saveToAdapters(payload, { silent: true });
      } catch (err) {
        console.warn('Kunde inte migrera träningsdata', err);
        toast('Data kunde inte läsas (korrupt?).');
      } finally {
        if (isMounted) setLoaded(true);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [primaryAdapter, secondaryAdapter, cloudAdapter, saveToAdapters]);

  // Spara
  useEffect(() => {
    if (!loaded) return;
    if (!hasSkippedInitialAutosave.current) {
      hasSkippedInitialAutosave.current = true;
      return;
    }

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      const save = async () => {
        try {
          const payload: PersistedData = withUpdatedAt({
            version: DATA_VERSION,
            data: { workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups },
          });
          await saveToAdapters(payload);
        } catch (saveErr) {
          console.warn('Autosave misslyckades', saveErr);
        }
      };
      save();
    }, 400);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups, primaryAdapter, secondaryAdapter, cloudAdapter, loaded, saveToAdapters]);

  const exportData = async () => {
    const payload: PersistedData = withUpdatedAt({
      version: DATA_VERSION,
      data: { workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups },
    });
    return primaryAdapter.exportData(payload);
  };

  const forceSave = async (override?: PersistedData['data']) => {
    const payload: PersistedData = withUpdatedAt({
      version: DATA_VERSION,
      data:
        override ?? { workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups },
    });
    try {
      await saveToAdapters(payload);
    } catch (saveErr) {
      console.warn('Force save misslyckades', saveErr);
    }
  };

  const value: WorkoutsContextValue = {
    workouts,
    addWorkout,
    updateWorkout,
    removeWorkout,
    forceSave,
    templates,
    addTemplate,
    updateTemplate,
    removeTemplate,
    bodyPhotos,
    addBodyPhoto,
    removeBodyPhoto,
    customExercises,
    addCustomExercise,
    removeCustomExercise,
    customGroups,
    addCustomGroup,
    removeCustomGroup,
    weeklyGoal,
    setWeeklyGoal,
    exportData,
    syncStatus,
    lastSyncedAt,
    syncErrorMessage,
    cloudSyncStatus,
  };

  return (
    <WorkoutsContext.Provider value={value}>
      {children}
    </WorkoutsContext.Provider>
  );
}

export function useWorkouts() {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) {
    throw new Error('useWorkouts måste användas inuti WorkoutsProvider');
  }
  return ctx;
}
