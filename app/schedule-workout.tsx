// app/schedule-workout.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Dumbbell,
  Palette,
  PlusCircle,
  ListChecks,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import GlassCard from '../components/ui/GlassCard';
import AppButton from '../components/ui/AppButton';
import ScreenHeader from '../components/ui/ScreenHeader';
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';
import { colors, gradients, inputs, layout, radii, spacing, typography } from '../constants/theme';
import { Exercise, Template, useWorkouts } from '../context/WorkoutsContext';
import ExerciseDetailCard from '../components/ui/ExerciseDetailCard';
import { toast } from '../utils/toast';
import ExerciseLibrary from '../components/ui/ExerciseLibrary';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';
import { compareISODate, parseISODate, todayISO } from '../utils/date';
import { createId } from '../utils/id';
import { sortWorkoutsByRecencyDesc } from '../utils/workoutRecency';

const MUSCLE_MAP: Record<string, string> = {
  Bröst: 'Bröst',
  Rygg: 'Rygg',
  Ben: 'Ben',
  Axlar: 'Axlar',
  Armar: 'Armar',
};

const normalizeMuscleGroup = (name: string, translate?: (k: string) => string) =>
  MUSCLE_MAP[name] || translate?.('exercises.groups.Övrigt') || 'Övrigt';
const MUSCLE_GROUPS = ['Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Övrigt'];

const COLOR_OPTIONS = [
  '#3b82f6', // blå
  '#22c55e', // grön
  '#f97316', // orange
  '#e11d48', // röd/rosa
  '#a855f7', // lila
];

type CalendarDay = { dateString: string };
type FocusedField = 'title' | 'notes' | 'customName' | null;

export default function ScheduleWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { addWorkout, updateWorkout, removeWorkout, templates, customExercises, workouts } = useWorkouts();
  const { t } = useTranslation();
  const editingId = Array.isArray(params.id) ? params.id[0] : params.id;

  // Card 1 – passinfo
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [titleError, setTitleError] = useState('');
  const [notesError, setNotesError] = useState('');
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [color, setColor] = useState<string>('#3b82f6');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dateError, setDateError] = useState('');
  const [weightError, setWeightError] = useState('');
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<{
    finalDates: string[];
    normalizedExercises: Exercise[];
    trimmedTitle: string;
    conflictingIds: string[];
  } | null>(null);
  const [calendarSeedDate, setCalendarSeedDate] = useState<string>(todayISO());
  const openDatePicker = (seed?: string) => {
    const next = seed && isValidDate(seed) ? seed : todayISO();
    setCalendarSeedDate(next);
    setShowCalendarPicker(true);
  };

  // Datum-hantering: flera datum för samma pass
  const todayStr = todayISO();
  const [dateInput, setDateInput] = useState('');
  const [dates, setDates] = useState<string[]>([]);

  const completedWorkouts = useMemo(
    () =>
      sortWorkoutsByRecencyDesc((workouts || []).filter((w) => w.isCompleted)),
    [workouts]
  );
  const latestCompletedWorkout = completedWorkouts[0];

  const latestWorkoutExercises = useMemo(() => {
    if (!latestCompletedWorkout?.exercises?.length) return [];
    const seen = new Set<string>();
    return latestCompletedWorkout.exercises
      .filter((ex) => {
        const key = ex.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((ex) => ({ name: ex.name, muscleGroup: ex.muscleGroup }));
  }, [latestCompletedWorkout]);

  const suggestionsByExercise = useMemo(() => {
    const byName = new Map<
      string,
      { muscleGroup?: string; sets: { reps: string; weight: number }[] }
    >();
    completedWorkouts.forEach((workout) => {
      workout.exercises?.forEach((ex) => {
        const key = ex.name.trim().toLowerCase();
        if (!key || byName.has(key)) return;
        const sets =
          ex.performedSets && ex.performedSets.length > 0
            ? ex.performedSets.map((s) => ({
                reps: s.reps || ex.reps || '10',
                weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 0,
              }))
            : buildInitialPerformedSets(ex.sets, ex.reps, ex.weight).map((s) => ({
                reps: s.reps,
                weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 0,
              }));
        byName.set(key, {
          muscleGroup: ex.muscleGroup,
          sets: sets.length > 0 ? sets : [{ reps: '10', weight: 0 }],
        });
      });
    });
    return byName;
  }, [completedWorkouts]);

  const mergedLibrary = useMemo(() => {
    const base = EXERCISE_LIBRARY.map((g) => ({ ...g, exercises: [...g.exercises] }));
    (customExercises || []).forEach((ex) => {
      const found = base.find((g) => g.group === ex.muscleGroup);
      if (found) {
        found.exercises.push({ name: ex.name, imageUri: ex.imageUri });
      } else {
        base.push({ group: ex.muscleGroup, exercises: [{ name: ex.name, imageUri: ex.imageUri }] });
      }
    });
    return base;
  }, [customExercises]);

  // Card 2 – övningar
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // När man trycker "Klar" för att gå till set/reps/vikt-läget
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    const existing = (workouts || []).find((w) => w.id === editingId);
    if (!existing) return;
    setTitle(existing.title || '');
    setNotes(existing.notes || '');
    setColor(existing.color || '#3b82f6');
    setDates([existing.date]);
    setDateInput(existing.date);
    if (existing.sourceTemplateId) {
      setSelectedTemplateId(existing.sourceTemplateId);
    }
    const mapped = (existing.exercises || []).map((ex) => ({
      id: ex.id || createId('sw-existing'),
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      muscleGroup: ex.muscleGroup,
      performedSets: ex.performedSets || buildInitialPerformedSets(ex.sets, ex.reps, ex.weight),
      done: false,
    })) as Exercise[];
    setSelectedExercises(mapped);
    setShowDetails(true);
  }, [editingId, workouts]);

  const applyTemplate = (template: Template) => {
    setSelectedTemplateId(template.id);
    setTitle((prev) => (prev ? prev : template.name));
    setColor(template.color);
    const mapped = template.exercises.map((ex) => ({
      id: createId('sw-template'),
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      muscleGroup: normalizeMuscleGroup(ex.muscleGroup || 'Övrigt', t),
      performedSets: buildInitialPerformedSets(ex.sets, ex.reps, ex.weight),
      done: false,
    })) as Exercise[];
    setSelectedExercises(mapped);
    setShowExerciseList(false);
    setShowCustomInput(false);
    setShowTemplatePicker(false);
    setShowDetails(true);
  };

  const isValidDate = (value: string) => {
    const m = /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
    if (!m) return false;
    return parseISODate(value) !== null;
  };

  const sanitizeNumericInput = (value: string) =>
    value.replace(/[^0-9.,-]/g, '').replace(',', '.');

  function buildInitialPerformedSets(sets: number, reps: string, weight: number) {
    return Array.from({ length: Math.max(1, sets || 1) }).map(() => ({
      reps: reps || '10',
      weight: weight || 0,
      done: false,
    }));
  }


  const addDate = () => {
    Haptics.selectionAsync();
    const trimmed = dateInput.trim();
    if (!trimmed || !isValidDate(trimmed)) {
      setDateError(t('schedule.dateFormat'));
      return;
    }
    if (compareISODate(trimmed, todayStr) < 0) {
      setDateError(t('schedule.datePast'));
      return;
    }
    setDateError('');
    if (dates.includes(trimmed)) {
      toast(t('schedule.dateExists'));
      return;
    }
    setDates((prev) => [...prev, trimmed].sort());
    setDateInput(trimmed);
  };

  const handleCalendarSelect = (day: CalendarDay) => {
    const iso = day.dateString;
    if (compareISODate(iso, todayStr) < 0) {
      setDateError(t('schedule.datePast'));
      return;
    }
    setCalendarSeedDate(iso);
    setDateError('');
    setDates((prev) => {
      if (prev.includes(iso)) {
        const next = prev.filter((d) => d !== iso).sort();
        setDateInput(next[next.length - 1] || '');
        return next;
      }
      const merged = new Set(prev);
      merged.add(iso);
      const next = Array.from(merged).sort();
      setDateInput(iso);
      return next;
    });
    Haptics.selectionAsync();
  };

  const calendarMarkedDates = useMemo(() => {
    const marks: Record<string, { selected: boolean; selectedColor: string; selectedTextColor: string }> = {};
    dates.forEach((d) => {
      marks[d] = {
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: colors.background,
      };
    });
    return marks;
  }, [dates]);

  const removeDate = (d: string) => {
    Haptics.selectionAsync();
    setDates((prev) => {
      const next = prev.filter((x) => x !== d);
      if (dateInput === d) setDateInput(next[next.length - 1] || '');
      return next;
    });
  };

  const clearAllDates = () => {
    setDates([]);
    setDateInput('');
    setDateError('');
    Haptics.selectionAsync();
  };

  const buildExerciseFromName = (name: string, group?: string): Exercise => {
    const suggestion = suggestionsByExercise.get(name.trim().toLowerCase());
    const suggestedSets =
      suggestion?.sets && suggestion.sets.length > 0
        ? suggestion.sets.map((s) => ({
            reps: s.reps || '10',
            weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 0,
            done: false,
          }))
        : buildInitialPerformedSets(1, '10', 0);
    const first = suggestedSets[0];
    return {
      id: createId('sw-lib'),
      name,
      sets: suggestedSets.length,
      reps: first?.reps || '10',
      weight: first?.weight ?? 0,
      muscleGroup: normalizeMuscleGroup(group || suggestion?.muscleGroup || '', t),
      performedSets: suggestedSets,
    };
  };

  const toggleExerciseFromLibrary = (name: string, group?: string) => {
    const exists = selectedExercises.find((e) => e.name === name);
    if (exists) {
      setSelectedExercises((prev) => prev.filter((e) => e.name !== name));
    } else {
      const libGroup = group || mergedLibrary.find((g) => g.exercises.some((ex) => ex.name === name))?.group;
      const newExercise: Exercise = buildExerciseFromName(name, libGroup);
      setSelectedExercises((prev) => [...prev, newExercise]);
    }
  };

  const handleAddCustomExercise = () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      toast(t('schedule.customNameError'));
      return;
    }

    const newExercise: Exercise = buildExerciseFromName(trimmed, t('exercises.groups.Övrigt'));

    setSelectedExercises((prev) => [...prev, newExercise]);
    setCustomName('');
    setShowCustomInput(false);
  };

  const handleRemoveExercise = (id: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    setSelectedExercises((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
    Haptics.selectionAsync();
  };

  const handleConfirmExercises = () => {
    if (selectedExercises.length === 0) {
      toast(t('schedule.noExercisesSelect'));
      return;
    }
    setShowDetails(true);
    setShowExerciseList(false);
    setShowCustomInput(false);
  };

  const addLatestExercise = (name: string, muscleGroup?: string) => {
    const exists = selectedExercises.some((e) => e.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast(t('schedule.latestExists', undefined, name));
      return;
    }
    setSelectedExercises((prev) => [...prev, buildExerciseFromName(name, muscleGroup)]);
    Haptics.selectionAsync();
    toast(t('schedule.latestAdded', undefined, name));
  };

  const plannedSummary = useMemo(() => {
    const firstDate = [...dates].sort()[0] || dateInput;
    return t('schedule.planSummary', undefined, {
      workouts: dates.length,
      exercises: selectedExercises.length,
      firstDate: firstDate || '-',
    });
  }, [t, dates, dateInput, selectedExercises.length]);

  const isReadyToSave = useMemo(() => {
    const hasDate = dates.length > 0 || isValidDate(dateInput);
    const hasExercises = selectedExercises.length > 0;
    return hasDate && hasExercises;
  }, [dates.length, dateInput, selectedExercises.length]);

  const updateExerciseField = (
    id: string,
    field: keyof Exercise,
    value: string
  ) => {
    const clean = field === 'weight' ? sanitizeNumericInput(value) : value;
    setSelectedExercises((prev) =>
      prev.map((ex) =>
        ex.id === id
          ? {
              ...ex,
              [field]:
                field === 'name'
                  ? clean
                  : field === 'reps'
                  ? clean
                  : field === 'muscleGroup'
                  ? normalizeMuscleGroup(clean, t)
                  : Number(clean) || 0,
            }
          : ex
      )
    );
  };

  const updateSetField = (
    id: string,
    setIndex: number,
    field: 'reps' | 'weight',
    value: string
  ) => {
    const clean =
      field === 'weight' ? sanitizeNumericInput(value) : value;
    setSelectedExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        const currentSets =
          ex.performedSets && ex.performedSets.length > 0
            ? ex.performedSets
            : buildInitialPerformedSets(ex.sets, ex.reps, ex.weight);
        const nextSets = currentSets.map((s, idx) =>
          idx === setIndex
            ? {
                ...s,
                [field]:
                  field === 'weight'
                    ? Number(clean) || 0
                    : clean,
              }
            : s
        );
        const first = nextSets[0];
        return {
          ...ex,
          performedSets: nextSets,
          sets: nextSets.length,
          reps: first?.reps || ex.reps,
          weight:
            first?.weight !== undefined ? first.weight : ex.weight,
        };
      })
    );
  };

  const addSetToExercise = (id: string) => {
    setSelectedExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        const currentSets =
          ex.performedSets && ex.performedSets.length > 0
            ? ex.performedSets
            : buildInitialPerformedSets(ex.sets, ex.reps, ex.weight);
        const last = currentSets[currentSets.length - 1] || {
          reps: ex.reps || '10',
          weight: ex.weight || 0,
          done: false,
        };
        const nextSets = [
          ...currentSets,
          { reps: last.reps, weight: last.weight, done: false },
        ];
        return {
          ...ex,
          performedSets: nextSets,
          sets: nextSets.length,
          reps: nextSets[0]?.reps || ex.reps,
          weight:
            nextSets[0]?.weight !== undefined
              ? nextSets[0].weight
              : ex.weight,
        };
      })
    );
  };

  const persistPlannedWorkouts = (
    finalTitle: string,
    finalDates: string[],
    normalizedExercises: Exercise[],
    mode: 'keep-both' | 'replace'
  ) => {
    if (mode === 'replace') {
      const plannedConflicts = (workouts || []).filter(
        (w) =>
          !w.isCompleted &&
          finalDates.includes(w.date) &&
          (!editingId || w.id !== editingId)
      );
      plannedConflicts.forEach((w) => removeWorkout(w.id));
    }
    if (editingId) {
      updateWorkout({
        id: editingId,
        title: finalTitle,
        date: finalDates[0] || todayStr,
        notes: notes.trim() || undefined,
        exercises: normalizedExercises,
        color,
        isCompleted: false,
        sourceTemplateId: selectedTemplateId || undefined,
      });
    } else {
      finalDates.forEach((date) => {
        addWorkout({
          id: createId('sw-plan'),
          title: finalTitle,
          date,
          notes: notes.trim() || undefined,
          exercises: normalizedExercises,
          color,
          isCompleted: false,
          sourceTemplateId: selectedTemplateId || undefined,
        });
      });
    }
    setPendingSavePayload(null);
    setShowConflictModal(false);
    toast(t('schedule.savedToast'));
    toast(t('schedule.savedBody'));
    router.push('/(tabs)/calendar');
  };

  const handleSavePlannedWorkouts = () => {
    Haptics.selectionAsync();
    const trimmedTitle = title.trim();
    const finalTitle = trimmedTitle || t('schedule.defaultTitle');
    setTitleError('');

    const finalDatesSet = new Set(dates);
    if (isValidDate(dateInput)) {
      finalDatesSet.add(dateInput.trim());
    }
    const finalDates = Array.from(finalDatesSet).sort();

    if (finalDates.length === 0) {
      toast(t('schedule.dateRequired'));
      return;
    }
    if (finalDates.some((d) => compareISODate(d, todayStr) < 0)) {
      toast(t('schedule.datePast'));
      return;
    }

    if (selectedExercises.length === 0) {
      toast(t('schedule.noExercises'));
      return;
    }

    if (selectedExercises.some((ex) => Number.isNaN(Number(ex.weight)))) {
      setWeightError(t('schedule.weightError'));
      return;
    }
    setWeightError('');

    const normalizedExercises = selectedExercises.map((ex) => {
      const plannedSets =
        ex.performedSets && ex.performedSets.length > 0
          ? ex.performedSets
          : buildInitialPerformedSets(ex.sets, ex.reps, ex.weight);
      const first = plannedSets[0];
      return {
        ...ex,
        performedSets: plannedSets,
        sets: plannedSets.length,
        reps: first?.reps || ex.reps,
        weight: first?.weight !== undefined ? first.weight : ex.weight,
      };
    });

    const conflictingPlanned = (workouts || []).filter(
      (w) =>
        !w.isCompleted &&
        finalDates.includes(w.date) &&
        (!editingId || w.id !== editingId)
    );
    if (conflictingPlanned.length > 0) {
      setPendingSavePayload({
        finalDates,
        normalizedExercises,
        trimmedTitle: finalTitle,
        conflictingIds: conflictingPlanned.map((w) => w.id),
      });
      setShowConflictModal(true);
      return;
    }

    persistPlannedWorkouts(finalTitle, finalDates, normalizedExercises, 'keep-both');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={gradients.appBackground}
        style={styles.full}
      >
        <KeyboardAvoidingView
          style={styles.full}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingBottom: 6 }}>
            <BackPill onPress={() => router.back()} />
          </View>
          <ScreenHeader title={t('schedule.title')} subtitle={t('schedule.subtitle')} tone="amber" />
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('schedule.nameLabel')}</Text>
              <Text numberOfLines={1} style={styles.summaryValue}>
                {title.trim() || '...'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('schedule.dateLabel')}</Text>
              <Text style={styles.summaryValue}>{dates.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('schedule.exercisesTitle')}</Text>
              <Text style={styles.summaryValue}>{selectedExercises.length}</Text>
            </View>
          </View>
          <Text style={styles.summaryMeta}>{plannedSummary}</Text>

          {/* CARD 1 – PASSINFO + DATUM */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('schedule.infoTitle')}</Text>
                <Text style={styles.cardText}>
                  {t('schedule.infoDesc')}
                </Text>
              </View>

              {/* FÄRGCIRKEL HÖGER UPPE */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowColorPicker((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color || '#3b82f6' },
                  ]}
                >
                  <Palette size={15} color="#0b1120" />
                </View>
              </TouchableOpacity>
            </View>

            {/* FÄRGPICKER POPUP */}
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
                    accessibilityLabel={`${t('schedule.colorLabel')} ${c}`}
                    accessibilityRole="button"
                  />
                ))}
              </View>
            )}

            {/* Namn */}
            <Text style={styles.label}>{t('schedule.nameLabel')}</Text>
            <TextInput
              value={title}
              onChangeText={(t) => {
                setTitleError('');
                setTitle(t.slice(0, 60));
              }}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setFocusedField((prev) => (prev === 'title' ? null : prev))}
              style={[styles.input, focusedField === 'title' && styles.inputFocused]}
              placeholder={t('schedule.namePlaceholder')}
              placeholderTextColor="#64748b"
              maxLength={60}
            />
            {titleError ? (
              <Text style={styles.errorText}>{titleError}</Text>
            ) : null}

            {/* Datum + lägg till fler datum */}
            <Text style={[styles.label, styles.labelSpaced]}>{t('schedule.dateLabel')}</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateInputButton}
                onPress={() => openDatePicker(dateInput)}
                accessibilityLabel={t('schedule.dateOpen')}
                accessibilityRole="button"
              >
                <CalendarIcon size={15} color={colors.textMain} />
                <Text style={styles.dateInputText}>
                  {dateInput || t('schedule.datePlaceholder')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addDateButton}
                onPress={addDate}
                activeOpacity={0.9}
                accessibilityLabel={t('schedule.dateAdd')}
                accessibilityRole="button"
              >
                <PlusCircle size={16} color="#022c22" />
              </TouchableOpacity>
            </View>
            {dateError ? (
              <Text style={styles.errorText}>{dateError}</Text>
            ) : null}
            {dates.length > 0 && (
              <View style={styles.datesList}>
                <View style={styles.datesHeaderRow}>
                  <Text style={styles.sectionLabel}>{t('schedule.selectedDates')}</Text>
                  <TouchableOpacity
                    style={styles.clearDatesButton}
                    onPress={clearAllDates}
                    accessibilityRole="button"
                    accessibilityLabel={t('schedule.clearDates')}
                  >
                    <Text style={styles.clearDatesText}>{t('schedule.clearDates')}</Text>
                  </TouchableOpacity>
                </View>
                {dates.map((d) => (
                  <View key={d} style={styles.dateItemRow}>
                    <TouchableOpacity
                      style={styles.dateLeft}
                      onPress={() => {
                        setDateInput(d);
                        setDateError('');
                        openDatePicker(d);
                        Haptics.selectionAsync();
                      }}
                      accessibilityLabel={t('schedule.dateEdit', undefined, d)}
                      accessibilityRole="button"
                      activeOpacity={0.8}
                    >
                      <CalendarIcon
                        size={13}
                        color={colors.accentBlue}
                      />
                      <Text style={styles.dateText}>{d}</Text>
                    </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeDate(d)}
                    activeOpacity={0.8}
                    accessibilityLabel={t('schedule.dateRemove', undefined, d)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.removeText}>{t('schedule.remove')}</Text>
                  </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {dates.length === 0 && (
              <View style={styles.emptyDatesBox}>
                <Text style={styles.emptyDatesText}>{t('schedule.noDatesYet')}</Text>
              </View>
            )}

            {/* Anteckningar */}
            <Text style={[styles.label, styles.labelSpaced]}>{t('schedule.notesLabel')}</Text>
            <TextInput
              value={notes}
              onChangeText={(value) => {
                if (value.length > 220) {
                  setNotesError(t('schedule.notesMax'));
                  setNotes(value.slice(0, 220));
                } else {
                  setNotesError('');
                  setNotes(value);
                }
              }}
              onFocus={() => setFocusedField('notes')}
              onBlur={() => setFocusedField((prev) => (prev === 'notes' ? null : prev))}
              style={[
                styles.input,
                styles.notesInput,
                focusedField === 'notes' && styles.inputFocused,
              ]}
              placeholder={t('schedule.notesPlaceholder')}
              placeholderTextColor="#64748b"
              multiline
              maxLength={220}
            />
            {notesError ? (
              <Text style={styles.errorText}>{notesError}</Text>
            ) : null}
            {weightError ? (
              <Text style={styles.errorText}>{weightError}</Text>
            ) : null}
          </GlassCard>

          {/* CARD 2 – VÄLJ ÖVNINGAR */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconCircle}>
                  <Dumbbell size={17} color={colors.accentBlue} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{t('schedule.exercisesTitle')}</Text>
                  <Text style={styles.cardText}>{t('schedule.exercisesDesc')}</Text>
                </View>
              </View>
            </View>

            {/* RAD: + Välj övning / + Egen övning */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipPrimary]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowExerciseList((prev) => !prev);
                }}
                accessibilityLabel={t('schedule.openLibrary')}
                accessibilityRole="button"
              >
                <PlusCircle size={15} color={colors.textMain} />
                <Text style={styles.actionChipText}>{t('schedule.chooseExercise')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipSecondary]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCustomInput((prev) => !prev);
                }}
                accessibilityLabel={t('schedule.addCustom')}
                accessibilityRole="button"
              >
                <PlusCircle size={15} color={colors.textMain} />
                <Text style={styles.actionChipText}>{t('schedule.customExercise')}</Text>
              </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionChip, styles.actionChipTertiary]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowTemplatePicker((prev) => !prev);
                setShowExerciseList(false);
                setShowCustomInput(false);
              }}
              accessibilityLabel={t('schedule.chooseRoutine')}
              accessibilityRole="button"
            >
              <ListChecks size={15} color={colors.textMain} />
                <Text style={styles.actionChipText}>{t('schedule.routines')}</Text>
              </TouchableOpacity>
            </View>

            {latestWorkoutExercises.length > 0 && (
              <View style={styles.latestBlock}>
                <Text style={styles.sectionLabel}>{t('schedule.latestTitle')}</Text>
                <View style={styles.latestRow}>
                  {latestWorkoutExercises.map((item) => (
                    <TouchableOpacity
                      key={`latest-${item.name}`}
                      style={styles.latestChip}
                      onPress={() => addLatestExercise(item.name, item.muscleGroup)}
                      accessibilityRole="button"
                      accessibilityLabel={t('schedule.latestA11y', undefined, item.name)}
                    >
                      <Text style={styles.latestChipText}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* EGEN ÖVNING INPUT */}
            {showCustomInput && (
              <View style={styles.customExerciseBox}>
                <Text style={styles.label}>{t('schedule.customLabel')}</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  onFocus={() => setFocusedField('customName')}
                  onBlur={() =>
                    setFocusedField((prev) =>
                      prev === 'customName' ? null : prev
                    )
                  }
                  style={[
                    styles.input,
                    focusedField === 'customName' && styles.inputFocused,
                  ]}
                  placeholder={t('schedule.customPlaceholder')}
                  placeholderTextColor="#64748b"
                />
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    handleAddCustomExercise();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.buttonText, styles.buttonTextLight]}>
                    {t('schedule.addCustomCta')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showTemplatePicker && (
              <View style={styles.templateLibrary}>
                <Text style={styles.sectionLabel}>
                  {t('schedule.templateTitle')}
                </Text>
                <View style={styles.templateListCard}>
                  {templates.length === 0 ? (
                    <View style={styles.templateEmpty}>
                      <Text style={styles.emptyText}>
                        {t('schedule.templateEmpty')}
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
                          accessibilityLabel={t('schedule.templateA11y', undefined, template.name)}
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
                          {active && (
                            <CheckCircle2 size={15} color={colors.accentGreen} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            {/* LISTA MED ÖVNINGAR (LODRET) */}
            {showExerciseList && (
              <ExerciseLibrary
                groups={mergedLibrary}
                selectedNames={selectedExercises.map((e) => e.name)}
                onToggle={(name, group) => {
                  Haptics.selectionAsync();
                  toggleExerciseFromLibrary(name, group);
                }}
                style={{ marginTop: 10 }}
              />
            )}

            {/* VALDA ÖVNINGAR (namnlista) */}
            <View style={styles.selectedBox}>
              <Text style={styles.sectionLabel}>{t('schedule.selectedExercises')}</Text>
              {selectedExercises.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t('schedule.selectedEmpty')}
                </Text>
              ) : (
                selectedExercises.map((ex) => (
                  <View key={ex.id} style={styles.selectedRow}>
                    <View style={styles.selectedLeft}>
                      <View style={styles.selectedDot} />
                      <Text style={styles.selectedName}>{ex.name}</Text>
                    </View>
                    <View style={styles.selectedActions}>
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => moveExercise(selectedExercises.findIndex((item) => item.id === ex.id), 'up')}
                        accessibilityRole="button"
                        accessibilityLabel={t('schedule.moveUpA11y', undefined, ex.name)}
                      >
                        <ChevronUp size={14} color={colors.textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.moveBtn}
                        onPress={() => moveExercise(selectedExercises.findIndex((item) => item.id === ex.id), 'down')}
                        accessibilityRole="button"
                        accessibilityLabel={t('schedule.moveDownA11y', undefined, ex.name)}
                      >
                        <ChevronDown size={14} color={colors.textMain} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveExercise(ex.id)}
                      >
                        <Text style={styles.removeText}>{t('schedule.remove')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* KLAR-KNAPP FÖR ATT GÅ VIDARE TILL SET/REPS/VIKT */}
            {selectedExercises.length > 0 && (
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirmExercises}
              >
                <Text style={[styles.buttonText, styles.buttonTextLight]}>
                  {t('schedule.confirmExercises')}
                </Text>
              </TouchableOpacity>
            )}
          </GlassCard>

          {/* DETALJKORT – SETS / REPS / VIKT */}
          {showDetails && selectedExercises.length > 0 && (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{t('schedule.detailsTitle')}</Text>
              <Text style={styles.cardText}>
                {t('schedule.detailsSubtitle')}
              </Text>

              {selectedExercises.map((ex) => {
                const sets =
                  ex.performedSets && ex.performedSets.length > 0
                    ? ex.performedSets
                    : buildInitialPerformedSets(ex.sets, ex.reps, ex.weight);

                return (
                  <ExerciseDetailCard
                    key={ex.id}
                    name={ex.name}
                    sets={sets}
                    muscleGroups={MUSCLE_GROUPS}
                    currentMuscle={ex.muscleGroup}
                    onSelectMuscle={(mg) =>
                      updateExerciseField(ex.id, 'muscleGroup' as any, mg)
                    }
                    onChangeSet={(idx, field, value) =>
                      updateSetField(ex.id, idx, field, value)
                    }
                    onAddSet={() => addSetToExercise(ex.id)}
                  />
                );
              })}
            </GlassCard>
          )}

          {/* SPARA PLANERADE PASS */}
            <AppButton
              title={t('schedule.saveCta')}
              variant="success"
              accessibilityLabel={t('schedule.saveA11y')}
              onPress={handleSavePlannedWorkouts}
              style={[styles.button, styles.saveButton]}
              disabled={!isReadyToSave}
            />
          </ScrollView>
        </KeyboardAvoidingView>
        <Modal
          visible={showCalendarPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCalendarPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('schedule.modalTitle')}</Text>
              <Text style={styles.modalHint}>{t('schedule.modalMultiHint')}</Text>
              <Calendar
                current={calendarSeedDate}
                minDate={todayStr}
                onDayPress={handleCalendarSelect}
                markedDates={calendarMarkedDates}
                theme={{
                  backgroundColor: 'transparent',
                  calendarBackground: 'transparent',
                  monthTextColor: colors.textMain,
                  dayTextColor: colors.textMain,
                  textDisabledColor: '#4b5563',
                  arrowColor: colors.textMain,
                }}
              />
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowCalendarPicker(false)}
                accessibilityLabel={t('schedule.modalClose')}
                accessibilityRole="button"
              >
                <Text style={styles.modalCloseText}>{t('schedule.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal
          visible={showConflictModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConflictModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('schedule.conflictTitle')}</Text>
              <Text style={styles.cardText}>
                {t('schedule.conflictBody', undefined, pendingSavePayload?.conflictingIds.length ?? 0)}
              </Text>
              <View style={styles.conflictActions}>
                <AppButton
                  title={t('schedule.conflictCancel')}
                  variant="ghost"
                  onPress={() => {
                    setShowConflictModal(false);
                    setPendingSavePayload(null);
                  }}
                />
                <AppButton
                  title={t('schedule.conflictKeepBoth')}
                  variant="secondary"
                  onPress={() => {
                    if (!pendingSavePayload) return;
                    persistPlannedWorkouts(
                      pendingSavePayload.trimmedTitle,
                      pendingSavePayload.finalDates,
                      pendingSavePayload.normalizedExercises,
                      'keep-both'
                    );
                  }}
                />
                <AppButton
                  title={t('schedule.conflictReplace')}
                  variant="danger"
                  onPress={() => {
                    if (!pendingSavePayload) return;
                    persistPlannedWorkouts(
                      pendingSavePayload.trimmedTitle,
                      pendingSavePayload.finalDates,
                      pendingSavePayload.normalizedExercises,
                      'replace'
                    );
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  full: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: spacing.md,
  },
  summaryCard: {
    marginTop: 6,
    marginBottom: 6,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#2a3a50',
    backgroundColor: 'rgba(8,14,26,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
  },
  summaryMeta: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 4,
  },
  summaryItem: {
    flex: 1,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#2a3a50',
    backgroundColor: '#0a1322',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 54,
    justifyContent: 'center',
  },
  summaryLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  summaryValue: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 2,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
    marginBottom: 10,
  },
  card: {
    marginTop: layout.sectionGapLg,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.button,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2c3d54',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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

  // Färgcirkel
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cdd9ea',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  colorOption: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#e5e7eb',
  },

  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  labelSpaced: {
    marginTop: 12,
  },
  input: {
    minHeight: inputs.height,
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    color: 'white',
    borderWidth: 1,
    borderColor: inputs.borderColor,
    ...typography.body,
  },
  inputFocused: {
    borderColor: colors.primaryBright,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  dateRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dateInputButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: inputs.height,
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
  },
  dateInputText: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  addDateButton: {
    width: 40,
    height: 40,
    borderRadius: radii.button,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  datesList: {
    marginTop: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#24354c',
    backgroundColor: '#08111f',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emptyDatesBox: {
    marginTop: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emptyDatesText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  datesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  clearDatesButton: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  clearDatesText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0b1220',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  modalTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 8,
  },
  modalHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 8,
  },
  modalClose: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  modalCloseText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '600',
  },
  dateItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#24354c',
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  latestBlock: {
    marginTop: 10,
    marginBottom: 2,
  },
  latestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  latestChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
  },
  latestChipText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.button,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334a67',
    minHeight: 36,
  },
  actionChipPrimary: {
    backgroundColor: '#0a1422',
  },
  actionChipSecondary: {
    backgroundColor: '#0a1422',
  },
  actionChipTertiary: {
    backgroundColor: '#0a1422',
  },
  actionChipText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },

  customExerciseBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e2a3d',
  },

  exerciseListBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    backgroundColor: '#050b16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 10,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMain,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  groupSection: {
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  groupIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  groupTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  groupSubtitle: {
    ...typography.micro,
    color: colors.textSoft,
  },
  groupListCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  exerciseRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#020617',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  exerciseRowActive: {
    backgroundColor: '#0b1220',
  },
  exerciseNameWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  exerciseNameActive: {
    color: '#bbf7d0',
    fontWeight: '600',
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1f2937',
  },
  exerciseDotActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  exerciseTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
  },

  selectedBox: {
    marginTop: 14,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#24354c',
    backgroundColor: '#08111f',
    padding: 10,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#24354c',
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moveBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
  },
  selectedName: {
    ...typography.body,
    color: colors.textMain,
  },
  removeText: {
    ...typography.micro,
    color: '#fb923c',
    fontWeight: '700',
  },
  conflictActions: {
    marginTop: 10,
    gap: 8,
  },

  confirmButton: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },

  templateLibrary: {
    marginTop: 12,
    backgroundColor: '#08111f',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#24354c',
    padding: 10,
  },
  templateListCard: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#24354c',
    backgroundColor: '#050d1a',
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
    backgroundColor: '#020617',
  },
  templateRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#24354c',
  },
  templateRowActive: {
    backgroundColor: '#10203a',
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
    borderColor: '#1f2937',
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

  button: {
    marginTop: 16,
    borderRadius: radii.button,
    paddingVertical: 12,
    minHeight: inputs.height,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButton: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: colors.success,
    borderColor: '#4ade80',
  },
  buttonText: {
    ...typography.bodyBold,
    color: '#04110a',
  },
  buttonTextLight: {
    color: colors.textMain,
  },
  errorText: {
    ...typography.caption,
    color: '#fca5a5',
    marginTop: 4,
  },
});
