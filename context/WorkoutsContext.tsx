// context/WorkoutsContext.tsx
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
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
  forceSave?: () => Promise<void>;

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
}

const WorkoutsContext = createContext<WorkoutsContextValue | undefined>(
  undefined
);

const STORAGE_PATH = `${FileSystem.documentDirectory}workouts-data.json`;
const BACKUP_DIR = `${FileSystem.documentDirectory}backups`;
const DATA_VERSION = 1;
const ASYNC_KEY = 'workouts-data';
type PersistedData = {
  version: number;
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

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [bodyPhotos, setBodyPhotos] = useState<BodyPhoto[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number>(3);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== Pass =====
  const addWorkout = (workout: Workout) => {
    setWorkouts((prev) => [...prev, workout]);
  };

  const updateWorkout = (workout: Workout) => {
    setWorkouts((prev) =>
      prev.map((w) => (w.id === workout.id ? workout : w))
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
          if (parsed.data) return parsed as PersistedData;
          // fallback om ingen wrapper
          return {
            version: 0,
            data: {
              workouts: parsed.workouts || [],
              templates: parsed.templates || [],
              bodyPhotos: parsed.bodyPhotos || [],
              weeklyGoal: parsed.weeklyGoal ?? 3,
            },
          };
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
            return JSON.parse(backupContent) as PersistedData;
          } catch (backupErr) {
            console.warn('Kunde inte läsa backup-data', backupErr);
            return null;
          }
        }
      },
      save: async (payload: PersistedData) => {
        const json = JSON.stringify(payload);
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
          if (parsed.data) return parsed as PersistedData;
          return {
            version: 0,
            data: {
              workouts: parsed.workouts || [],
              templates: parsed.templates || [],
              bodyPhotos: parsed.bodyPhotos || [],
              weeklyGoal: parsed.weeklyGoal ?? 3,
              customExercises: parsed.customExercises || [],
              customGroups: parsed.customGroups || [],
            },
          };
        } catch (err) {
          console.warn('AsyncStorage load fail', err);
          return null;
        }
      },
      save: async (payload: PersistedData) => {
        try {
          await AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(payload));
        } catch (err) {
          console.warn('AsyncStorage save fail', err);
          throw err;
        }
      },
      exportData: async (payload: PersistedData) =>
        JSON.stringify(payload.data, null, 2),
    }),
    []
  );

  const supabaseStorageAdapter: StorageAdapter | null = useMemo(() => {
    if (!supabase) return null;
    return {
      load: async () => {
        const { data, error } = await supabase
          .from('app_state')
          .select('version,data')
          .eq('id', 'default')
          .maybeSingle();
        if (error) {
          console.warn('Supabase load error', error);
          return null;
        }
        if (!data) return null;
        return {
          version: data.version ?? 0,
          data: data.data as PersistedData['data'],
        };
      },
      save: async (payload: PersistedData) => {
        const { error } = await supabase
          .from('app_state')
          .upsert({
            id: 'default',
            version: payload.version,
            data: payload.data,
          });
        if (error) throw error;
      },
      exportData: async (payload: PersistedData) =>
        JSON.stringify(payload.data, null, 2),
    };
  }, []);

  // primär adapter = AsyncStorage (snabb). sekundär = fil för backup. tredje = supabase om den finns.
  const primaryAdapter: StorageAdapter = asyncStorageAdapter;
  const secondaryAdapter: StorageAdapter | null = fileStorageAdapter;
  const cloudAdapter: StorageAdapter | null = supabaseStorageAdapter;

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
    const cleanWorkouts = (data.workouts || []).map((w) => ({
      ...w,
      exercises: sanitizeExercises(w.exercises),
    }));
    const cleanTemplates = (data.templates || []).map((t) => ({
      ...t,
      exercises: sanitizeExercises(t.exercises as any),
    }));
    return {
      workouts: cleanWorkouts,
      templates: cleanTemplates,
      bodyPhotos: data.bodyPhotos || [],
      weeklyGoal: data.weeklyGoal ?? 3,
      customExercises: sanitizeExercises(data.customExercises),
      customGroups: Array.from(
        new Set([
          ...(data.customGroups || []),
          ...sanitizeExercises(data.customExercises).map((ex) => ex.muscleGroup),
        ])
      ),
    };
  };

  // Ladda
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      let persisted = null;
      try {
        persisted = await primaryAdapter.load();
      } catch (err) {
        console.warn('Load primary failed', err);
      }
      if (!persisted && secondaryAdapter) {
        try {
          persisted = await secondaryAdapter.load();
        } catch (err) {
          console.warn('Load secondary failed', err);
        }
      }
      if (!persisted && cloudAdapter) {
        try {
          persisted = await cloudAdapter.load();
        } catch (err) {
          console.warn('Load cloud failed', err);
        }
      }

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
        const payload: PersistedData = {
          version: DATA_VERSION,
          data: migrated,
        };
        const adapters = [primaryAdapter, secondaryAdapter, cloudAdapter].filter(Boolean) as StorageAdapter[];
        for (const ad of adapters) {
          try {
            await ad.save(payload);
          } catch (err) {
            console.warn('Could not save migrated to adapter', err);
          }
        }
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
  }, [primaryAdapter, secondaryAdapter]);

  // Spara
  useEffect(() => {
    if (!loaded) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = setTimeout(() => {
      const save = async () => {
        try {
          const payload: PersistedData = {
            version: DATA_VERSION,
            data: { workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups },
          };
          const adapters = [primaryAdapter, secondaryAdapter, cloudAdapter].filter(Boolean) as StorageAdapter[];
          for (const ad of adapters) {
            await ad.save(payload);
          }
        } catch (err) {
          console.warn('Kunde inte spara träningsdata', err);
          toast('Kunde inte spara data');
        }
      };
      save();
    }, 400);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups, primaryAdapter, secondaryAdapter, loaded]);

  const exportData = async () => {
    const payload: PersistedData = {
      version: DATA_VERSION,
      data: { workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups },
    };
    return primaryAdapter.exportData(payload);
  };

  const forceSave = async (override?: PersistedData['data']) => {
    const payload: PersistedData = {
      version: DATA_VERSION,
      data:
        override ?? { workouts, templates, bodyPhotos, weeklyGoal, customExercises, customGroups },
    };
    try {
      const adapters = [primaryAdapter, secondaryAdapter, cloudAdapter].filter(Boolean) as StorageAdapter[];
      for (const ad of adapters) {
        await ad.save(payload);
      }
    } catch (err) {
      console.warn('Force save failed', err);
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
