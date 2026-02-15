// app/schedule-workout.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Dumbbell,
  Palette,
  PlusCircle,
  ListChecks,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import GlassCard from '../components/ui/GlassCard';
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';
import { colors, gradients, typography } from '../constants/theme';
import { Exercise, Template, useWorkouts } from '../context/WorkoutsContext';
import ExerciseDetailCard from '../components/ui/ExerciseDetailCard';
import { toast } from '../utils/toast';
import ExerciseLibrary from '../components/ui/ExerciseLibrary';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';
import { addDaysISO, parseISODate, todayISO } from '../utils/date';

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

export default function ScheduleWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { addWorkout, updateWorkout, templates, customExercises, workouts } = useWorkouts();
  const { t } = useTranslation();
  const editingId = Array.isArray(params.id) ? params.id[0] : params.id;

  // Card 1 – passinfo
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [titleError, setTitleError] = useState('');
  const [notesError, setNotesError] = useState('');
  const [color, setColor] = useState<string>('#3b82f6');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dateError, setDateError] = useState('');
  const [weightError, setWeightError] = useState('');
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [calendarSeedDate, setCalendarSeedDate] = useState<string>(todayISO());
  const openDatePicker = (seed?: string) => {
    const next = seed && isValidDate(seed) ? seed : todayISO();
    setCalendarSeedDate(next);
    setShowCalendarPicker(true);
  };

  // Datum-hantering: flera datum för samma pass
  const todayStr = todayISO();
  const [dateInput, setDateInput] = useState(todayStr);
  const [dates, setDates] = useState<string[]>([todayStr]);
  const quickDates = [
    todayStr,
    addDaysISO(todayStr, 1),
  ];

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
      id: ex.id || `${ex.name}-${Math.random()}`,
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
      id: `${ex.name}-${Date.now()}-${Math.random()}`,
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

  const buildInitialPerformedSets = (sets: number, reps: string, weight: number) =>
    Array.from({ length: Math.max(1, sets || 1) }).map(() => ({
      reps: reps || '10',
      weight: weight || 0,
      done: false,
    }));

  const addDate = () => {
    Haptics.selectionAsync();
    const trimmed = dateInput.trim();
    if (!trimmed || !isValidDate(trimmed)) {
      setDateError(t('schedule.dateFormat'));
      return;
    }
    setDateError('');
    if (dates.includes(trimmed)) {
      Alert.alert(t('schedule.errorTitle'), t('schedule.dateExists'));
      return;
    }
    setDates((prev) => [...prev, trimmed].sort());
    setDateInput(trimmed);
  };

  const handleCalendarSelect = (day: CalendarDay) => {
    const iso = day.dateString;
    setDateInput(iso);
    setCalendarSeedDate(iso);
    setDateError('');
    setDates((prev) => {
      const merged = new Set(prev);
      merged.add(iso);
      return Array.from(merged).sort();
    });
    setShowCalendarPicker(false);
    Haptics.selectionAsync();
  };

  const removeDate = (d: string) => {
    Haptics.selectionAsync();
    if (dates.length === 1) {
      Alert.alert(t('schedule.errorTitle'), t('schedule.dateMin'));
      return;
    }
    setDates((prev) => prev.filter((x) => x !== d));
  };

  const toggleExerciseFromLibrary = (name: string) => {
    const exists = selectedExercises.find((e) => e.name === name);
    if (exists) {
      setSelectedExercises((prev) => prev.filter((e) => e.name !== name));
    } else {
      const group = mergedLibrary.find((g) =>
        g.exercises.some((ex) => ex.name === name)
      );
      const newExercise: Exercise = {
        id: Date.now().toString() + name,
        name,
        sets: 1,
        reps: '10',
        weight: 0,
        muscleGroup: normalizeMuscleGroup(group?.group || '', t),
        performedSets: buildInitialPerformedSets(1, '10', 0),
      };
      setSelectedExercises((prev) => [...prev, newExercise]);
    }
  };

  const handleAddCustomExercise = () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      Alert.alert(t('common.error'), t('schedule.customNameError'));
      return;
    }

    const newExercise: Exercise = {
      id: Date.now().toString() + trimmed,
      name: trimmed,
      sets: 1,
      reps: '10',
      weight: 0,
      muscleGroup: t('exercises.groups.Övrigt'),
      performedSets: buildInitialPerformedSets(1, '10', 0),
    };

    setSelectedExercises((prev) => [...prev, newExercise]);
    setCustomName('');
    setShowCustomInput(false);
  };

  const handleRemoveExercise = (id: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const handleConfirmExercises = () => {
    if (selectedExercises.length === 0) {
      Alert.alert(t('schedule.errorTitle'), t('schedule.noExercisesSelect'));
      return;
    }
    setShowDetails(true);
    setShowExerciseList(false);
    setShowCustomInput(false);
  };

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

  const handleSavePlannedWorkouts = () => {
    Haptics.selectionAsync();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setTitleError(t('schedule.titleError'));
      return;
    }
    setTitleError('');

    const finalDatesSet = new Set(dates);
    if (isValidDate(dateInput)) {
      finalDatesSet.add(dateInput.trim());
    }
    const finalDates = Array.from(finalDatesSet).sort();

    if (finalDates.length === 0) {
      Alert.alert(t('schedule.errorTitle'), t('schedule.dateRequired'));
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert(t('schedule.errorTitle'), t('schedule.noExercises'));
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
        weight:
          first?.weight !== undefined ? first.weight : ex.weight,
      };
    });

    if (editingId) {
      updateWorkout({
        id: editingId,
        title: trimmedTitle,
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
          id: Date.now().toString() + date,
          title: trimmedTitle,
          date,
          notes: notes.trim() || undefined,
          exercises: normalizedExercises,
          color,
          isCompleted: false,
          sourceTemplateId: selectedTemplateId || undefined,
        });
      });
    }

    toast(t('schedule.savedToast'));
    Alert.alert(t('schedule.savedTitle'), t('schedule.savedBody'), [
      {
        text: t('schedule.openCalendar'),
        style: 'default',
        onPress: () => router.replace('/(tabs)/calendar'),
      },
      { text: t('schedule.stay'), style: 'cancel' },
    ]);
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
          <Text style={styles.title}>{t('schedule.title')}</Text>
          <Text style={styles.subtitle}>
            {t('schedule.subtitle')}
          </Text>

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
                  <Palette size={16} color="#0b1120" />
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
              style={styles.input}
              placeholder={t('schedule.namePlaceholder')}
              placeholderTextColor="#64748b"
              maxLength={60}
            />
            {titleError ? (
              <Text style={styles.errorText}>{titleError}</Text>
            ) : null}

            {/* Datum + lägg till fler datum */}
            <Text style={[styles.label, { marginTop: 10 }]}>{t('schedule.dateLabel')}</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateInputButton}
                onPress={() => openDatePicker(dateInput)}
                accessibilityLabel={t('schedule.dateOpen')}
                accessibilityRole="button"
              >
                <CalendarIcon size={16} color={colors.textMain} />
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
                <PlusCircle size={18} color="#022c22" />
              </TouchableOpacity>
            </View>
            {dateError ? (
              <Text style={styles.errorText}>{dateError}</Text>
            ) : null}
            <View style={styles.quickDateRow}>
              {quickDates.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.quickDateChip,
                    dateInput === d && styles.quickDateChipActive,
                  ]}
                onPress={() => {
                    setDateInput(d);
                    setDates([d]);
                    setDateError('');
                  }}
                  accessibilityLabel={t('schedule.dateQuickA11y', undefined, { isToday: d === todayStr, date: d })}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.quickDateText,
                      dateInput === d && styles.quickDateTextActive,
                    ]}
                  >
                    {d === todayStr ? t('schedule.today') : d}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.datePickerChip}
                onPress={() => openDatePicker(dateInput)}
              >
                <Text style={styles.quickDateText}>{t('schedule.dateOther')}</Text>
              </TouchableOpacity>
            </View>

            {dates.length > 0 && (
              <View style={styles.datesList}>
                <Text style={styles.sectionLabel}>{t('schedule.selectedDates')}</Text>
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
                        size={14}
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

            {/* Anteckningar */}
            <Text style={[styles.label, { marginTop: 10 }]}>{t('schedule.notesLabel')}</Text>
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
              style={[styles.input, styles.notesInput]}
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
                  <Dumbbell size={18} color={colors.accentBlue} />
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
                <PlusCircle size={14} color="#022c22" />
                <Text style={styles.actionChipTextPrimary}>{t('schedule.chooseExercise')}</Text>
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
                <PlusCircle size={14} color="#0f172a" />
                <Text style={styles.actionChipTextSecondary}>{t('schedule.customExercise')}</Text>
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
              <ListChecks size={14} color="#0b1120" />
                <Text style={styles.actionChipTextTertiary}>{t('schedule.routines')}</Text>
              </TouchableOpacity>
            </View>

            {/* EGEN ÖVNING INPUT */}
            {showCustomInput && (
              <View style={styles.customExerciseBox}>
                <Text style={styles.label}>{t('schedule.customLabel')}</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  style={styles.input}
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
                  <Text style={styles.buttonText}>{t('schedule.addCustomCta')}</Text>
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
                            <CheckCircle2 size={16} color={colors.accentGreen} />
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
                  toggleExerciseFromLibrary(name);
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
                    <TouchableOpacity
                      onPress={() => handleRemoveExercise(ex.id)}
                    >
                      <Text style={styles.removeText}>{t('schedule.remove')}</Text>
                    </TouchableOpacity>
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
                <Text style={styles.buttonText}>
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
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSavePlannedWorkouts}
              activeOpacity={0.9}
              accessibilityLabel={t('schedule.saveA11y')}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>{t('schedule.saveCta')}</Text>
            </TouchableOpacity>
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
              <Calendar
                current={calendarSeedDate}
                onDayPress={handleCalendarSelect}
                markedDates={{
                  [dateInput]: {
                    selected: true,
                    selectedColor: colors.primary,
                    selectedTextColor: '#0b1120',
                  },
                  [calendarSeedDate]: {
                    selected: true,
                    disableTouchEvent: true,
                    selectedColor: '#1f2937',
                    selectedTextColor: colors.textMain,
                  },
                }}
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
    paddingTop: 12,
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
    marginTop: 10,
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
    borderRadius: 999,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
  },

  // Färgcirkel
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b1120',
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#e5e7eb',
  },

  label: {
    ...typography.caption,
    color: '#e5e7eb',
    marginBottom: 4,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: 'white',
    borderWidth: 1,
    borderColor: '#1f2937',
    ...typography.body,
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
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputText: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  addDateButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datesList: {
    marginTop: 8,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  quickDateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  datePickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#0b1220',
  },
  quickDateChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBright + '26',
  },
  quickDateText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '600',
  },
  quickDateTextActive: {
    ...typography.caption,
    color: '#bbf7d0',
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
    paddingVertical: 4,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    ...typography.caption,
    color: colors.textMain,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  actionChipPrimary: {
    backgroundColor: colors.success,
  },
  actionChipSecondary: {
    backgroundColor: colors.secondary,
  },
  actionChipTertiary: {
    backgroundColor: colors.primary,
  },
  actionChipTextPrimary: {
    ...typography.caption,
    color: '#022c22',
    fontWeight: '700',
  },
  actionChipTextSecondary: {
    ...typography.caption,
    color: '#0b1120',
    fontWeight: '700',
  },
  actionChipTextTertiary: {
    ...typography.caption,
    color: '#0b1120',
    fontWeight: '700',
  },

  customExerciseBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111827',
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
    marginBottom: 6,
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
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
  },
  selectedName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  removeText: {
    ...typography.micro,
    color: '#f97316',
  },

  confirmButton: {
    marginTop: 10,
    backgroundColor: colors.accentGreen,
  },

  templateLibrary: {
    marginTop: 10,
    backgroundColor: '#050b16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 10,
  },
  templateListCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
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
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  templateRowActive: {
    backgroundColor: '#0b1220',
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
    ...typography.bodyBold,
    color: colors.textMain,
  },
  templateMeta: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
  },

  button: {
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  saveButton: {
    backgroundColor: colors.primary, // planera pass: lila
  },
  buttonText: {
    ...typography.bodyBold,
    color: '#0b1120',
  },
  errorText: {
    ...typography.caption,
    color: '#fca5a5',
    marginTop: 4,
  },
});
