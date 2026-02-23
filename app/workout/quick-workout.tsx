import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Clock, Dumbbell, ListChecks, Palette, PlusCircle, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmptyState from '../../components/ui/EmptyState';
import AppButton from '../../components/ui/AppButton';
import ExerciseDetailCard from '../../components/ui/ExerciseDetailCard';
import ExerciseLibrary from '../../components/ui/ExerciseLibrary';
import GlassCard from '../../components/ui/GlassCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import StaggerReveal from '../../components/ui/StaggerReveal';
import { EXERCISE_LIBRARY } from '../../constants/exerciseLibrary';
import { colors, gradients, inputs, layout, radii, spacing, typography } from '../../constants/theme';
import { Template, useWorkouts } from '../../context/WorkoutsContext';
import {
  clearOngoingQuickWorkout,
  loadOngoingQuickWorkout,
  saveOngoingQuickWorkout,
  type OngoingQuickWorkoutSnapshot,
} from '../../utils/ongoingQuickWorkout';
import { toast } from '../../utils/toast';
import { useTranslation } from '../../context/TranslationContext';
import BackPill from '../../components/ui/BackPill';
import { createId } from '../../utils/id';
import { sortWorkoutsByRecencyDesc } from '../../utils/workoutRecency';

type QuickSet = {
  id: string;
  reps: string;
  weight: string;
  done?: boolean;
};

type QuickExercise = {
  id: string;
  name: string;
  muscleGroup?: string;
  sets: QuickSet[];
};

type ExerciseSuggestion = {
  muscleGroup?: string;
  sets: { reps: string; weight: string }[];
};

const MUSCLE_GROUPS = [
  'Bröst',
  'Rygg',
  'Ben',
  'Axlar',
  'Armar',
  'Övrigt',
];
const COLOR_OPTIONS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#e11d48'];

const generateId = () => createId('qw');

const sanitizeNumeric = (value: string) => value.replace(/[^0-9.,-]/g, '').replace(',', '.');
const sanitizeReps = (value: string) => value.replace(/[^0-9xX/–-]/g, '').slice(0, 6);
const normalizeExerciseKey = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const parseWeightInput = (value: string) => {
  if (!value) return 0;
  const normalized = value.replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? NaN : Math.max(0, num);
};
const normalizeMuscleGroup = (
  value?: string,
  translate?: (path: string, fallback?: string | ((...args: any[]) => string), args?: any) => string
) => {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : translate?.('exercises.groups.Övrigt') || 'Övrigt';
};

const todayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const buildExercisesFromTemplate = (
  params: { templateId?: string },
  templates: Template[],
  plannedExercises?: {
    id?: string;
    name: string;
    sets: number;
    reps: string;
    weight: number;
    muscleGroup?: string;
    performedSets?: { reps: string; weight: number }[];
  }[]
) => {
  if (plannedExercises && plannedExercises.length > 0) {
    return plannedExercises.map<QuickExercise>((ex) => ({
      id: generateId(),
      name: ex.name ?? 'Övning',
      muscleGroup: ex.muscleGroup || 'Övrigt',
      sets: Array.from({ length: ex.sets ?? 1 }).map((_, idx) => {
        const performed = ex.performedSets?.[idx];
        return {
          id: generateId(),
          reps: performed?.reps ?? ex.reps ?? '8–10',
          weight:
            performed && performed.weight != null
              ? String(performed.weight)
              : ex.weight != null && !Number.isNaN(Number(ex.weight))
              ? String(ex.weight)
              : '',
        };
      }),
    }));
  }

  if (params.templateId && Array.isArray(templates)) {
    const template = templates.find((t) => t.id === params.templateId);
    if (template && Array.isArray(template.exercises)) {
      return template.exercises.map<QuickExercise>((ex) => ({
        id: generateId(),
        name: ex.name ?? 'Övning',
        muscleGroup: ex.muscleGroup,
        sets: Array.from({ length: ex.sets ?? 3 }).map(() => ({
          id: generateId(),
          reps: ex.reps ? String(ex.reps) : '8–10',
          weight: ex.weight != null && !Number.isNaN(Number(ex.weight)) ? String(ex.weight) : '',
        })),
      }));
    }
  }
  return [];
};

const useWorkoutTimer = (startTimestamp: number) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const updateElapsed = () =>
        setElapsedSeconds(Math.floor((Date.now() - startTimestamp) / 1000));

      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    }, [startTimestamp])
  );

  return elapsedSeconds;
};

export default function QuickWorkoutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    addWorkout,
    updateWorkout,
    addTemplate,
    templates,
    customExercises,
    workouts,
    forceSave,
    bodyPhotos,
    weeklyGoal,
  } = useWorkouts();
  const params = useLocalSearchParams<{
    title?: string;
    color?: string;
    templateId?: string;
    plannedId?: string;
    resume?: string;
    resumeSnapshot?: string;
  }>();
  const hasResumeFlag = params.resume === '1' || params.resume === 'true';

  const parsedResume = useMemo(() => {
    if (!hasResumeFlag) return null;
    if (!params.resumeSnapshot || typeof params.resumeSnapshot !== 'string') return null;
    try {
      return JSON.parse(decodeURIComponent(params.resumeSnapshot));
    } catch {
      return null;
    }
  }, [hasResumeFlag, params.resumeSnapshot]);

  const resolvedPlannedWorkout = useMemo(() => {
    if (!params.plannedId) return undefined;
    return workouts.find((w) => w.id === params.plannedId);
  }, [params.plannedId, workouts]);

  const resolvedTemplate = useMemo(() => {
    if (!params.templateId || !Array.isArray(templates)) return undefined;
    return templates.find((t) => t.id === params.templateId);
  }, [params.templateId, templates]);

const defaultColor =
    (params.color && typeof params.color === 'string' && params.color) ||
    resolvedTemplate?.color ||
    resolvedPlannedWorkout?.color ||
    '#a855f7';

const defaultTitle =
    (params.title && typeof params.title === 'string' && params.title) ||
    resolvedTemplate?.name ||
    resolvedPlannedWorkout?.title ||
    (params.templateId ? t('quick.templateTitleDefault') : t('quick.quickTitleDefault'));

  const [startTimestamp, setStartTimestamp] = useState<number>(
    parsedResume?.startTimestamp || Date.now()
  );
  const [title, setTitle] = useState<string>(parsedResume?.title || defaultTitle);
  const [color, setColor] = useState<string>(parsedResume?.color || defaultColor);
  const [templateColor, setTemplateColor] = useState<string>(parsedResume?.color || defaultColor);
  const [exercises, setExercises] = useState<QuickExercise[]>(() => {
    if (parsedResume?.exercises) return parsedResume.exercises;
    return buildExercisesFromTemplate(params, templates, resolvedPlannedWorkout?.exercises as any);
  });

  const elapsedSeconds = useWorkoutTimer(startTimestamp);
  const formattedTime = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [finishSummary, setFinishSummary] = useState<{
    exercises: number;
    sets: number;
    minutes: number;
  } | null>(null);
  const [templateName, setTemplateName] = useState<string>(defaultTitle);
  const templateColors = ['#a855f7', '#22c55e', '#3b82f6', '#f97316', '#ec4899'];

  const [inputError, setInputError] = useState('');
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(
    parsedResume?.showDetails ?? !!params.resume
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [focusTargetKey, setFocusTargetKey] = useState<string | null>(null);
  const [lastWorkoutExercises, setLastWorkoutExercises] = useState<
    {
      id: string;
      name: string;
      sets: number;
      reps: string;
      weight: number;
      muscleGroup?: string;
      performedSets?: { reps: string; weight: number }[];
    }[]
  >([]);

  const completedWorkouts = useMemo(
    () => sortWorkoutsByRecencyDesc((workouts || []).filter((w) => w.isCompleted)),
    [workouts]
  );
  const latestCompletedWorkout = completedWorkouts[0];

  const suggestionsByExercise = useMemo(() => {
    const byName = new Map<string, ExerciseSuggestion>();
    completedWorkouts.forEach((workout) => {
      workout.exercises?.forEach((ex) => {
        const key = normalizeExerciseKey(ex.name);
        if (!key || byName.has(key)) return;

        const performedSets =
          ex.performedSets && ex.performedSets.length > 0
            ? ex.performedSets.map((set) => ({
                reps: set.reps?.trim() || ex.reps || '10',
                weight:
                  set.weight != null && Number.isFinite(Number(set.weight))
                    ? String(set.weight)
                    : '',
              }))
            : Array.from({ length: Math.max(1, ex.sets || 1) }).map(() => ({
                reps: ex.reps || '10',
                weight:
                  ex.weight != null && Number.isFinite(Number(ex.weight))
                    ? String(ex.weight)
                    : '',
              }));

        byName.set(key, {
          muscleGroup: ex.muscleGroup,
          sets: performedSets.length > 0 ? performedSets : [{ reps: '10', weight: '' }],
        });
      });
    });
    return byName;
  }, [completedWorkouts]);

  const getSuggestionForName = useCallback(
    (exerciseName: string) => {
      const normalized = normalizeExerciseKey(exerciseName);
      if (!normalized) return undefined;
      const exact = suggestionsByExercise.get(normalized);
      if (exact) return exact;

      // fallback: tolerate minor naming variations such as extra words/suffixes
      for (const [key, suggestion] of suggestionsByExercise.entries()) {
        if (key.includes(normalized) || normalized.includes(key)) {
          return suggestion;
        }
      }
      return undefined;
    },
    [suggestionsByExercise]
  );

  const recentExercises = useMemo(() => {
    if (!latestCompletedWorkout?.exercises?.length) return [];
    const seen = new Set<string>();
    return latestCompletedWorkout.exercises
      .filter((ex) => {
        const key = normalizeExerciseKey(ex.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((ex) => ({ name: ex.name, muscleGroup: ex.muscleGroup }));
  }, [latestCompletedWorkout]);

  // Spara pågående pass för återupptagning
  useEffect(() => {
    const snapshot: OngoingQuickWorkoutSnapshot = {
      title,
      color,
      notes,
      exercises,
      showDetails,
      templateId: params.templateId,
      plannedId: params.plannedId,
      startTimestamp,
    };
    saveOngoingQuickWorkout(snapshot);
  }, [title, color, notes, exercises, showDetails, params.templateId, params.plannedId, startTimestamp]);

  // Ladda ev. pågående sparat pass
  useEffect(() => {
    const loadOngoing = async () => {
      // Återuppta endast när användaren uttryckligen valt resume-flödet.
      if (!hasResumeFlag) return;
      const parsed = await loadOngoingQuickWorkout();
      if (!parsed?.exercises) return;
      if (parsed.startTimestamp) setStartTimestamp(parsed.startTimestamp);
      setTitle(parsed.title || defaultTitle);
      setColor(parsed.color || defaultColor);
      setNotes(parsed.notes || '');
      setExercises(parsed.exercises || []);
      setShowDetails(parsed.showDetails ?? true);
    };
    loadOngoing();
  }, [hasResumeFlag, defaultTitle, defaultColor]);

  // Hård reset för nytt pass (utan resume) så gammalt state aldrig läcker in.
  useEffect(() => {
    if (hasResumeFlag) return;
    setStartTimestamp(Date.now());
    setTitle(defaultTitle);
    setColor(defaultColor);
    setTemplateColor(defaultColor);
    setNotes('');
    setNotesError('');
    setInputError('');
    setShowDetails(false);
    setShowExerciseList(false);
    setShowCustomInput(false);
    setShowTemplatePicker(false);
    setShowColorPicker(false);
    setSelectedTemplateId(null);
    setCustomName('');
    setFocusTargetKey(null);
    setLastWorkoutExercises([]);
    setExercises(
      buildExercisesFromTemplate(
        {
          templateId:
            typeof params.templateId === 'string' ? params.templateId : undefined,
        },
        templates,
        resolvedPlannedWorkout?.exercises as any
      )
    );
  }, [
    hasResumeFlag,
    defaultTitle,
    defaultColor,
    params.templateId,
    params.plannedId,
    templates,
    resolvedPlannedWorkout,
  ]);

  const mergedLibrary = useMemo(() => {
    const base = EXERCISE_LIBRARY.map((g) => ({ ...g, exercises: [...g.exercises] }));
    customExercises.forEach((ex) => {
      const found = base.find((g) => g.group === ex.muscleGroup);
      if (found) {
        found.exercises.push({ name: ex.name, imageUri: ex.imageUri });
      } else {
        base.push({ group: ex.muscleGroup, exercises: [{ name: ex.name, imageUri: ex.imageUri }] });
      }
    });
    return base;
  }, [customExercises]);

  const applyTemplate = (t: Template) => {
    setSelectedTemplateId(t.id);
    const nextExercises: QuickExercise[] = t.exercises.map((ex) => ({
      id: generateId(),
      name: ex.name,
      muscleGroup: ex.muscleGroup || 'Övrigt',
      sets: Array.from({ length: Math.max(1, ex.sets || 1) }).map(() => ({
        id: generateId(),
        reps: ex.reps || '10',
        weight: ex.weight != null ? String(ex.weight) : '',
      })),
    }));
    setExercises(nextExercises);
    setShowExerciseList(false);
    setShowCustomInput(false);
    setShowTemplatePicker(false);
    setShowDetails(true);
    if (!title.trim()) setTitle(t.name);
    if (t.color) setColor(t.color);
  };

  const { totalSets, completedSets } = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const ex of exercises) total += ex.sets.length;
    for (const ex of exercises) {
      for (const set of ex.sets) {
        const hasReps = String(set.reps || '').trim().length > 0;
        const parsed = parseWeightInput(String(set.weight || ''));
        const hasWeight = Number.isFinite(parsed) && parsed > 0;
        if (hasReps || hasWeight || set.done) completed += 1;
      }
    }
    return { totalSets: total, completedSets: completed };
  }, [exercises]);
  const progressPct = totalSets > 0 ? Math.max(4, Math.round((completedSets / totalSets) * 100)) : 4;

  const updateSetField = (
    exerciseId: string,
    setId: string,
    field: keyof Pick<QuickSet, 'reps' | 'weight'>,
    value: string
  ) => {
    const clean = field === 'weight' ? sanitizeNumeric(value) : sanitizeReps(value.trim());
    if (field === 'weight') {
      const parsed = parseWeightInput(clean);
      if (Number.isNaN(parsed)) {
        setInputError(t('quick.weightInvalid'));
      } else {
        setInputError('');
      }
    }

    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: clean } : s)),
            }
          : ex
      )
    );
  };

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        id: generateId(),
        name: t('quick.newExercise', undefined, prev.length + 1),
        muscleGroup: t('exercises.groups.Övrigt'),
        sets: [{ id: generateId(), reps: '10', weight: '', done: false }],
      },
    ]);
  };

  const buildSuggestedSets = useCallback(
    (exerciseName: string): QuickSet[] => {
      const suggested = getSuggestionForName(exerciseName);
      if (!suggested || suggested.sets.length === 0) {
        return [{ id: generateId(), reps: '10', weight: '', done: false }];
      }
      return suggested.sets.map((set) => ({
        id: generateId(),
        reps: set.reps || '10',
        weight: set.weight || '',
        done: false,
      }));
    },
    [getSuggestionForName]
  );

  const addExerciseFromName = (name: string, muscle?: string) => {
    const suggested = getSuggestionForName(name);
    setExercises((prev) => [
      ...prev,
      {
        id: generateId(),
        name,
        muscleGroup: normalizeMuscleGroup(muscle || suggested?.muscleGroup || 'Övrigt', t),
        sets: buildSuggestedSets(name),
      },
    ]);
  };

  const toggleExerciseFromLibrary = (name: string, group?: string) => {
    setExercises((prev) => {
      const exists = prev.find((e) => e.name === name);
      if (exists) {
        return prev.filter((e) => e.name !== name);
      }
      const suggested = getSuggestionForName(name);
      return [
        ...prev,
        {
          id: generateId(),
          name,
          muscleGroup: normalizeMuscleGroup(group || suggested?.muscleGroup || t('exercises.groups.Övrigt'), t),
          sets: buildSuggestedSets(name),
        },
      ];
    });
  };

  const handleAddCustomExercise = () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      toast(t('quick.customNameError'));
      return;
    }
    addExerciseFromName(trimmed, t('exercises.groups.Övrigt'));
    setCustomName('');
    setShowCustomInput(false);
    Haptics.selectionAsync();
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const addSetToExercise = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: [...ex.sets, { id: generateId(), reps: '8–10', weight: '' }],
            }
          : ex
      )
    );
  };

  const handleCompleteSet = (exerciseId: string, setIndex: number) => {
    const exerciseIdx = exercises.findIndex((ex) => ex.id === exerciseId);
    if (exerciseIdx < 0) return;
    const currentExercise = exercises[exerciseIdx];
    const currentSet = currentExercise.sets[setIndex];
    if (!currentSet) return;

    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((s, idx) => (idx === setIndex ? { ...s, done: true } : s)),
            }
          : ex
      )
    );

    Haptics.selectionAsync();
    toast(t('quick.setCompletedToast', undefined, setIndex + 1));

    const nextSetInExercise = currentExercise.sets[setIndex + 1];
    if (nextSetInExercise) {
      setFocusTargetKey(`${exerciseId}:${nextSetInExercise.id}:reps`);
      return;
    }

    const nextExercise = exercises[exerciseIdx + 1];
    if (nextExercise && nextExercise.sets.length > 0) {
      setFocusTargetKey(`${nextExercise.id}:${nextExercise.sets[0].id}:reps`);
    }
  };

  const addRecentExercise = (name: string, muscleGroup?: string) => {
    const alreadyAdded = exercises.some((ex) => ex.name.toLowerCase() === name.toLowerCase());
    if (alreadyAdded) {
      toast(t('quick.recentAlreadyAdded', undefined, name));
      return;
    }
    Haptics.selectionAsync();
    addExerciseFromName(name, muscleGroup);
    toast(t('quick.recentAddedToast', undefined, name));
  };

  const handleFinish = () => {
    Haptics.selectionAsync();
   const hasInvalidWeight = exercises.some((ex) =>
     ex.sets.some((s) => Number.isNaN(parseWeightInput(s.weight)))
   );
   if (hasInvalidWeight) {
      setInputError(t('quick.weightInvalid'));
      return;
    }
    setInputError('');

    Alert.alert(t('quick.finishConfirm'), t('quick.finishQuestion'), [
      { text: t('quick.finishContinue'), style: 'cancel' },
      { text: t('quick.finishSave'), style: 'default', onPress: saveWorkout },
    ]);
  };

  const saveWorkout = async () => {
    if (!title.trim()) {
      toast(t('quick.titleError'));
      return;
    }
    const hasInvalidWeight = exercises.some((ex) =>
      ex.sets.some((s) => Number.isNaN(parseWeightInput(s.weight)))
    );
    if (hasInvalidWeight) {
      toast(t('quick.weightInvalid'));
      return;
    }

    const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60) || 1);

    const workoutExercises = exercises.map((ex) => {
      const parsedSets = ex.sets.map((s) => ({
        reps: s.reps,
        weight: parseWeightInput(s.weight),
      }));
      const avgWeight =
        parsedSets.reduce((sum, s) => sum + (s.weight || 0), 0) / (parsedSets.length || 1);

      return {
        id: generateId(),
        name: ex.name,
        sets: ex.sets.length,
        reps: ex.sets[0]?.reps ?? '8–10',
        weight: Number.isNaN(avgWeight) ? 0 : Math.round(avgWeight),
        muscleGroup: normalizeMuscleGroup(ex.muscleGroup, t),
        performedSets: parsedSets,
      };
    });

    setLastWorkoutExercises(workoutExercises);

    const plannedId =
      params.plannedId && typeof params.plannedId === 'string'
        ? params.plannedId
        : undefined;

    const workout = {
      id: plannedId || generateId(),
      title,
      date: todayString(),
      notes: notes.trim(),
      color,
      durationMinutes,
      exercises: workoutExercises,
      isCompleted: true,
      sourceTemplateId:
        params.templateId && typeof params.templateId === 'string'
          ? params.templateId
          : undefined,
    };

    let nextWorkouts = workouts;
    if (plannedId && workouts.some((w) => w.id === plannedId)) {
      updateWorkout(workout);
      nextWorkouts = workouts.map((w) => (w.id === plannedId ? workout : w));
    } else {
      addWorkout(workout);
      nextWorkouts = [...workouts, workout];
    }
    // Spara direkt så avslutade pass inte tappas om appen stängs
    if (forceSave) {
      await forceSave({
        workouts: nextWorkouts,
        templates,
        bodyPhotos,
        weeklyGoal,
        customExercises,
      });
    }
    clearOngoingQuickWorkout();
    setTemplateName(title);
    setTemplateColor(color);
    setFinishSummary({
      exercises: workoutExercises.length,
      sets: totalSets,
      minutes: durationMinutes,
    });
    setFinishModalVisible(true);
  };

  const handleCancel = () => {
    Alert.alert(t('quick.cancelTitle'), t('quick.cancelBody'), [
      { text: t('quick.cancelContinue'), style: 'cancel' },
      {
        text: t('quick.cancelConfirm'),
        style: 'destructive',
        onPress: () => {
          clearOngoingQuickWorkout();
          router.back();
        },
      },
    ]);
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim() || title;
    const colorValid = /^#([0-9a-fA-F]{6})$/.test(templateColor);
    const sourceExercises =
      lastWorkoutExercises.length > 0
        ? lastWorkoutExercises
        : exercises.map((ex) => {
            const sets = ex.sets.map((s) => ({
              reps: s.reps,
              weight: parseWeightInput(s.weight),
            }));
            const avg = sets.reduce((sum, s) => sum + (s.weight || 0), 0) / (sets.length || 1);
            return {
              id: generateId(),
              name: ex.name,
              sets: ex.sets.length,
              reps: ex.sets[0]?.reps ?? '8–10',
              weight: Number.isFinite(avg) ? Math.round(avg) : 0,
              muscleGroup: normalizeMuscleGroup(ex.muscleGroup, t),
              performedSets: sets,
            };
          });

    const template: Template = {
      id: generateId(),
      name,
      color: colorValid ? templateColor : color,
      description: notes.trim() || undefined,
      exercises: sourceExercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        muscleGroup: ex.muscleGroup,
      })),
    };

    addTemplate(template);
    setTemplateModalVisible(false);
    toast(t('quick.templateSavedToast'));
    toast(t('quick.templateSavedBody'));
    router.push('/');
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.backPillWrap}>
          <BackPill />
        </View>
        <Modal
          visible={finishModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFinishModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('quick.finishCongratsTitle')}</Text>
              <Text style={styles.modalSub}>
                {t('quick.finishCongratsBody', undefined, {
                  exercises: finishSummary?.exercises ?? 0,
                  sets: finishSummary?.sets ?? 0,
                  minutes: finishSummary?.minutes ?? 0,
                })}
              </Text>
              <View style={styles.finishStatsRow}>
                <View style={styles.finishStatPill}>
                  <Text style={styles.finishStatLabel}>{t('quick.finishStatExercises')}</Text>
                  <Text style={styles.finishStatValue}>{finishSummary?.exercises ?? 0}</Text>
                </View>
                <View style={styles.finishStatPill}>
                  <Text style={styles.finishStatLabel}>{t('quick.finishStatSets')}</Text>
                  <Text style={styles.finishStatValue}>{finishSummary?.sets ?? 0}</Text>
                </View>
                <View style={styles.finishStatPill}>
                  <Text style={styles.finishStatLabel}>{t('quick.finishStatMinutes')}</Text>
                  <Text style={styles.finishStatValue}>{finishSummary?.minutes ?? 0}</Text>
                </View>
              </View>
              <View style={styles.finishActionsStack}>
                <AppButton
                  title={t('quick.saveTemplate')}
                  variant="secondary"
                  onPress={() => {
                    setFinishModalVisible(false);
                    setTemplateModalVisible(true);
                  }}
                />
                <AppButton
                  title={t('quick.toHome')}
                  variant="primary"
                  onPress={() => {
                    setFinishModalVisible(false);
                    router.push('/');
                  }}
                />
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={() => setFinishModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={templateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTemplateModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('quick.saveTemplate')}</Text>
              <Text style={styles.modalSub}>{t('quick.saveTemplateSub')}</Text>
              <TextInput
                style={styles.modalInput}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder={t('quick.templateNamePlaceholder')}
                placeholderTextColor={colors.textSoft}
              />
              <TextInput
                style={styles.modalInput}
                value={templateColor}
                onChangeText={setTemplateColor}
                placeholder={t('quick.templateColorPlaceholder')}
                placeholderTextColor={colors.textSoft}
              />
              <View style={styles.colorRow}>
                {templateColors.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      templateColor === c && styles.colorCircleActive,
                    ]}
                    onPress={() => setTemplateColor(c)}
                  />
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={() => setTemplateModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSave]}
                  onPress={handleSaveTemplate}
                >
                  <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <StaggerReveal delay={40}>
            <View style={styles.headerRow}>
              <View style={styles.titleRow}>
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <ScreenHeader
                  title={title}
                  subtitle={t('quick.ongoing')}
                  compact
                  tone="blue"
                  style={styles.titleHeader}
                />
              </View>

              <View style={styles.headerRight}>
                <View style={styles.timerPill}>
                  <Clock size={14} color={colors.textMain} />
                  <Text style={styles.timerText}>{formattedTime}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
                  <X size={16} color={colors.textSoft} />
                </TouchableOpacity>
              </View>
            </View>
          </StaggerReveal>

          <StaggerReveal delay={90}>
            <GlassCard style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>{t('quick.progressTitle')}</Text>
                <Text style={styles.progressLabel}>{t('quick.progressLabel', undefined, totalSets)}</Text>
              </View>

              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPct}%` },
                  ]}
                />
              </View>

              <Text style={styles.progressHint}>
                {t('quick.progressHint')}
              </Text>
            </GlassCard>
          </StaggerReveal>

          <StaggerReveal delay={140}>
            <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('quick.passInfo')}</Text>
                <Text style={styles.cardText}>{t('quick.passInfoSub')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowColorPicker((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.colorCircle, { backgroundColor: color || colors.accentBlue }]}>
                  <Palette size={16} color={colors.background} />
                </View>
              </TouchableOpacity>
            </View>
            {showColorPicker && (
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    style={[
                      styles.colorOption,
                      { backgroundColor: c },
                      c === color && styles.colorOptionActive,
                    ]}
                    accessibilityLabel={`${t('quick.colorLabel')} ${c}`}
                    accessibilityRole="button"
                  />
                ))}
              </View>
            )}
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={title}
              onChangeText={setTitle}
              placeholder={t('quick.titlePlaceholder')}
              placeholderTextColor={colors.textSoft}
            />
            <TextInput
              style={[styles.notesInput, { marginTop: 8 }]}
              value={notes}
              onChangeText={(value) => {
                if (value.length > 220) {
                  setNotesError(t('quick.notesMax'));
                  setNotes(value.slice(0, 220));
                } else {
                  setNotesError('');
                  setNotes(value);
                }
              }}
              placeholder={t('quick.notesPlaceholder')}
              placeholderTextColor={colors.textSoft}
              multiline
              maxLength={220}
            />
            {notesError ? <Text style={styles.errorText}>{notesError}</Text> : null}
            </GlassCard>
          </StaggerReveal>

          <StaggerReveal delay={190}>
            <GlassCard style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconCircle}>
                  <Dumbbell size={18} color={colors.accentBlue} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{t('quick.chooseExercises')}</Text>
                  <Text style={styles.cardText}>
                    {t('quick.chooseExercisesSub')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionChip,
                  styles.actionChipPrimary,
                  showExerciseList && styles.actionChipActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowExerciseList((prev) => !prev);
                  setShowCustomInput(false);
                  setShowTemplatePicker(false);
                }}
                accessibilityLabel={t('quick.openLibrary')}
                accessibilityRole="button"
              >
                <PlusCircle size={15} color={showExerciseList ? colors.textMain : colors.textSoft} />
                <Text style={[styles.actionChipText, showExerciseList && styles.actionChipTextActive]}>
                  {t('quick.chooseExercise')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionChip,
                  styles.actionChipSecondary,
                  showCustomInput && styles.actionChipActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCustomInput((prev) => !prev);
                  setShowExerciseList(false);
                  setShowTemplatePicker(false);
                }}
                accessibilityLabel={t('quick.addCustom')}
                accessibilityRole="button"
              >
                <PlusCircle size={15} color={showCustomInput ? colors.textMain : colors.textSoft} />
                <Text style={[styles.actionChipText, showCustomInput && styles.actionChipTextActive]}>
                  {t('quick.customExercise')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionChip,
                  styles.actionChipTertiary,
                  showTemplatePicker && styles.actionChipActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowTemplatePicker((prev) => !prev);
                  setShowExerciseList(false);
                  setShowCustomInput(false);
                }}
                accessibilityLabel={t('quick.chooseRoutine')}
                accessibilityRole="button"
              >
                <ListChecks size={15} color={showTemplatePicker ? colors.textMain : colors.textSoft} />
                <Text style={[styles.actionChipText, showTemplatePicker && styles.actionChipTextActive]}>
                  {t('quick.routines')}
                </Text>
              </TouchableOpacity>
            </View>

            {recentExercises.length > 0 && (
              <View style={styles.recentBlock}>
                <Text style={styles.recentTitle}>{t('quick.recentTitle')}</Text>
                <View style={styles.recentRow}>
                  {recentExercises.map((item) => (
                    <TouchableOpacity
                      key={`recent-${item.name}`}
                      style={styles.recentChip}
                      activeOpacity={0.9}
                      onPress={() => addRecentExercise(item.name, item.muscleGroup)}
                      accessibilityRole="button"
                      accessibilityLabel={t('quick.recentA11y', undefined, item.name)}
                    >
                      <Text style={styles.recentChipText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {showCustomInput && (
              <View style={styles.customExerciseBox}>
                <Text style={styles.customLabel}>{t('quick.customLabel')}</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  style={styles.input}
                  placeholder={t('quick.customPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                />
                <AppButton
                  title={t('quick.addCustomCta')}
                  onPress={handleAddCustomExercise}
                  style={{ marginTop: 6 }}
                  variant="secondary"
                />
              </View>
            )}

            {showExerciseList && (
              <ExerciseLibrary
                groups={mergedLibrary}
                selectedNames={exercises.map((e) => e.name)}
                onToggle={(name, group) => {
                  Haptics.selectionAsync();
                  toggleExerciseFromLibrary(name, group || '');
                }}
                style={{ marginTop: 10 }}
                showMuscleChips
                muscleGroups={MUSCLE_GROUPS}
                selectedMuscleFor={(name) => exercises.find((e) => e.name === name)?.muscleGroup}
                onSelectMuscle={(name, mg) =>
                  setExercises((prev) =>
                    prev.map((ex) => (ex.name === name ? { ...ex, muscleGroup: mg } : ex))
                  )
                }
              />
            )}

            {showTemplatePicker && (
              <View style={styles.templateLibrary}>
                <Text style={styles.sectionLabel}>
                  {t('quick.templateTitle')}
                </Text>
                <View style={styles.templateListCard}>
                  {templates.length === 0 ? (
                    <View style={styles.templateEmpty}>
                      <Text style={styles.emptyText}>
                        {t('quick.templateEmpty')}
                      </Text>
                    </View>
                  ) : (
                    templates.map((template, idx) => {
                      const active = template.id === selectedTemplateId;
                      const isLast = idx === templates.length - 1;
                      return (
                        <TouchableOpacity
                          key={template.id}
                          style={[
                            styles.templateRow,
                            !isLast && styles.templateRowDivider,
                            active && styles.templateRowActive,
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            applyTemplate(template);
                          }}
                          activeOpacity={0.85}
                          accessibilityLabel={t('quick.templateA11y', undefined, template.name)}
                          accessibilityRole="button"
                        >
                          <View style={styles.templateLeft}>
                            <View
                              style={[
                                styles.templateDot,
                                { backgroundColor: template.color || colors.primary },
                              ]}
                            />
                            <View>
                              <Text style={styles.templateName}>{template.name}</Text>
                              {template.description ? (
                                <Text style={styles.templateMeta} numberOfLines={1}>
                                  {template.description}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {active && <CheckCircle2 size={16} color={colors.accentGreen} />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            <View style={styles.selectedBox}>
            <Text style={styles.sectionLabel}>{t('quick.selectedLabel')}</Text>
            {exercises.length === 0 ? (
              <EmptyState
                title={t('quick.emptyExercisesTitle')}
                subtitle={t('quick.emptyExercisesSub')}
                ctaLabel={t('quick.chooseExercises')}
                onPressCta={() => {
                  setShowExerciseList(true);
                  setShowCustomInput(false);
                }}
              />
            ) : (
                exercises.map((ex) => (
                  <View key={ex.id} style={styles.selectedRow}>
                    <View style={styles.selectedLeft}>
                      <View style={styles.selectedDot} />
                      <Text style={styles.selectedName}>{ex.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeExercise(ex.id)}>
                    <Text style={styles.removeText}>{t('common.remove')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            </View>

            {exercises.length > 0 && (
              <AppButton
                title={t('quick.confirmExercises')}
                onPress={() => {
                  setShowDetails(true);
                  setShowExerciseList(false);
                  setShowCustomInput(false);
                }}
                variant="success"
                style={styles.confirmButton}
                accessibilityLabel={t('quick.confirmExercises')}
              />
            )}
            </GlassCard>
          </StaggerReveal>

          {showDetails && exercises.length > 0 && (
            <StaggerReveal delay={240}>
              <View style={styles.listContainer}>
              {exercises.map((ex) => (
                <ExerciseDetailCard
                  key={ex.id}
                  exerciseId={ex.id}
                  name={ex.name}
                  muscleGroups={MUSCLE_GROUPS}
                  currentMuscle={ex.muscleGroup}
                  onSelectMuscle={(mg) =>
                    setExercises((prev) =>
                      prev.map((item) => (item.id === ex.id ? { ...item, muscleGroup: mg } : item))
                    )
                  }
                  sets={ex.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: s.done, setId: s.id }))}
                  onChangeSet={(setIdx, field, value) =>
                    updateSetField(ex.id, ex.sets[setIdx].id, field, value)
                  }
                  onAddSet={() => addSetToExercise(ex.id)}
                  onCompleteSet={(setIdx) => handleCompleteSet(ex.id, setIdx)}
                  focusTargetKey={focusTargetKey}
                  onFocusHandled={() => setFocusTargetKey(null)}
                />
              ))}

              <TouchableOpacity style={styles.addExerciseButton} onPress={addExercise} activeOpacity={0.9}>
                <Text style={styles.addExerciseText}>{t('quick.addExercise')}</Text>
              </TouchableOpacity>

              {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
              </View>
            </StaggerReveal>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            title={t('quick.finish')}
            variant="primary"
            onPress={() => {
              handleFinish();
              toast(t('quick.finishToast'));
            }}
          />
          <Text style={styles.finishButtonSub}>{t('quick.finishSummary', undefined, totalSets)}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  backPillWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  pageContent: {
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.sectionGap,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  titleHeader: {
    flex: 1,
    marginBottom: 0,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.primaryBright,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 8,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  timerText: {
    color: colors.textMain,
    fontWeight: '600',
    fontSize: 12,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  progressCard: {
    marginBottom: layout.sectionGap,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressTitle: {
    ...typography.title,
    fontSize: 15,
    color: colors.textMain,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  progressBarBackground: {
    height: 10,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  progressHint: {
    ...typography.micro,
    marginTop: 6,
    color: colors.textSoft,
  },
  card: {
    marginTop: layout.sectionGap,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
    lineHeight: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.button,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionChipPrimary: {
    backgroundColor: colors.surface,
  },
  actionChipSecondary: {
    backgroundColor: colors.surface,
  },
  actionChipTertiary: {
    backgroundColor: colors.surface,
  },
  actionChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBright,
  },
  actionChipText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '700',
  },
  actionChipTextActive: {
    color: colors.textMain,
  },
  customExerciseBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    padding: 10,
    marginBottom: 10,
  },
  customLabel: {
    ...typography.caption,
    color: colors.textMain,
    marginBottom: 4,
  },
  selectedBox: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMain,
    marginBottom: 6,
  },
  recentBlock: {
    marginBottom: 8,
  },
  recentTitle: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 6,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  recentChipText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
  },
  selectedName: {
    ...typography.body,
    color: colors.textMain,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
  },
  confirmButton: {
    marginTop: 12,
  },
  removeText: {
    ...typography.micro,
    color: colors.warning,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 70,
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  addExerciseButton: {
    marginTop: 4,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addExerciseText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  errorText: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 6,
  },
  templateLibrary: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
  },
  templateListCard: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  templateEmpty: {
    padding: 12,
  },
  templateRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSoft,
  },
  templateRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  templateRowActive: {
    backgroundColor: colors.backgroundSoft,
  },
  templateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  templateDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  templateName: {
    ...typography.body,
    color: colors.textMain,
  },
  templateMeta: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  modalSub: {
    ...typography.caption,
    color: colors.textSoft,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  finishStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  finishStatPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingVertical: 8,
    alignItems: 'center',
  },
  finishStatLabel: {
    ...typography.micro,
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  finishStatValue: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 2,
  },
  finishActionsStack: {
    gap: 8,
    marginTop: 2,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.button,
    borderWidth: 1,
  },
  modalCancel: {
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  modalSave: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  modalCancelText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  modalSaveText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '700',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  colorOptionActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
  },
  input: {
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    minHeight: inputs.height,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    fontSize: 13,
  },
  button: {
    borderRadius: radii.button,
    paddingVertical: 11,
    minHeight: inputs.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  buttonText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
  },
  finishButtonSub: {
    ...typography.micro,
    color: colors.textMain,
    marginTop: 2,
  },
});
