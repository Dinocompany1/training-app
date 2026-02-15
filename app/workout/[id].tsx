// app/workout/[id].tsx
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar as CalendarIcon, ListChecks, Pencil, Play, Save, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackPill from '../../components/ui/BackPill';
import GlassCard from '../../components/ui/GlassCard';
import { colors, gradients } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { toast } from '../../utils/toast';
import { parseISODate, toISODate } from '../../utils/date';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { workouts, removeWorkout, updateWorkout, addWorkout } = useWorkouts();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const workout = useMemo(
    () => workouts.find((w) => w.id === id),
    [workouts, id]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(workout?.title ?? '');
  const [date, setDate] = useState(workout?.date ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(() => {
    if (workout?.date) {
      const parsed = parseISODate(workout.date);
      if (parsed) return parsed;
    }
    return new Date();
  });
  const [notes, setNotes] = useState(workout?.notes ?? '');
  const [detailError, setDetailError] = useState('');
  const [editedExercises, setEditedExercises] = useState(() => {
    if (!workout?.exercises) return [];
    return workout.exercises.map((ex) => ({
      ...ex,
      performedSets:
        ex.performedSets && ex.performedSets.length > 0
          ? ex.performedSets
          : Array.from({ length: ex.sets }).map(() => ({
              reps: ex.reps || '0',
              weight: ex.weight || 0,
              done: false,
            })),
    }));
  });

  if (!workout) {
    return (
      <View style={[styles.full, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' }]}>
        <Text style={styles.notFoundText}>{t('workoutDetail.notFound')}</Text>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert(
      t('workoutDetail.deleteTitle'),
      t('workoutDetail.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const removed = workout;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            removeWorkout(workout.id);
            toast(t('workoutDetail.deletedToast'));
            Alert.alert(t('workoutDetail.deletedTitle'), t('workoutDetail.deletedBody'), [
              {
                text: t('common.undo'),
                style: 'default',
                onPress: () => {
                  Haptics.selectionAsync();
                  addWorkout(removed);
                },
              },
              {
                text: t('common.ok'),
                style: 'default',
                onPress: () => router.back(),
              },
            ]);
          },
        },
      ]
    );
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert(t('common.error'), t('workoutDetail.titleEmpty'));
      return;
    }

    const updatedExercises =
      editedExercises.length > 0
        ? editedExercises.map((ex) => ({
            ...ex,
            sets: ex.performedSets?.length || ex.sets,
          }))
        : workout.exercises;

    const updatedWorkout = {
      ...workout,
      title: trimmedTitle,
      date,
      notes,
      exercises: updatedExercises,
    };

    updateWorkout(updatedWorkout);
    toast(t('workoutDetail.savedToast'));
    setIsEditing(false);
    Alert.alert(t('workoutDetail.savedTitle'), t('workoutDetail.savedBody'));
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    const nextDate = selectedDate || pickerDate;
    setShowDatePicker(false);
    setPickerDate(nextDate);
    setDate(toISODate(nextDate));
    setDetailError('');
  };

  const handleExercisePress = (exerciseName: string) => {
    router.push(`/exercise/${encodeURIComponent(exerciseName)}`);
  };

  return (
    <LinearGradient
      colors={gradients.appBackground}
      style={styles.full}
    >
      <ScrollView
        style={[
          styles.container,
          { paddingTop: Math.max(16, insets.top + 12) },
        ]}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* BACK + TITLE */}
        <View style={styles.topRow}>
          <BackPill onPress={() => router.back()} />
          <Text style={styles.screenTitle}>{t('workoutDetail.title')}</Text>
        </View>

        {/* PASSINFO */}
        <GlassCard style={styles.card}>
          {isEditing ? (
            <>
              <Text style={styles.label}>{t('workoutDetail.nameLabel')}</Text>
              <TextInput
                value={title}
                onChangeText={(value) => {
                  if (value.length > 60) {
                    setDetailError(t('workoutDetail.titleMax'));
                    setTitle(value.slice(0, 60));
                  } else {
                    setDetailError('');
                    setTitle(value);
                  }
                }}
                style={styles.input}
                placeholder={t('workoutDetail.namePlaceholder')}
                placeholderTextColor="#64748b"
                maxLength={60}
              />

              <Text style={[styles.label, { marginTop: 10 }]}>{t('workoutDetail.dateLabel')}</Text>
              <View style={styles.datePickerRow}>
                <TouchableOpacity
                  style={styles.datePickerField}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.9}
                  accessibilityLabel={t('workoutDetail.dateOpen')}
                  accessibilityRole="button"
                >
                  <CalendarIcon size={16} color={colors.textMain} />
                  <Text style={styles.datePickerText}>
                    {date || t('workoutDetail.datePlaceholder')}
                  </Text>
                </TouchableOpacity>
                <View style={styles.dateQuickRow}>
                  {[
                    { label: t('workoutDetail.today'), value: new Date() },
                    {
                      label: t('workoutDetail.tomorrow'),
                      value: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    },
                  ].map((d) => {
                    const iso = toISODate(d.value);
                    const active = date === iso;
                    return (
                      <TouchableOpacity
                        key={d.label}
                        style={[
                          styles.dateQuickChip,
                          active && styles.dateQuickChipActive,
                        ]}
                        onPress={() => {
                          setDate(iso);
                          setPickerDate(d.value);
                          setDetailError('');
                          Haptics.selectionAsync();
                        }}
                        accessibilityLabel={t('workoutDetail.dateQuickA11y', undefined, d.label)}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.dateQuickChipText,
                            active && styles.dateQuickChipTextActive,
                          ]}
                        >
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={[styles.label, { marginTop: 10 }]}>{t('workoutDetail.notesLabel')}</Text>
              <TextInput
                value={notes}
                onChangeText={(value) => {
                  if (value.length > 220) {
                    setDetailError(t('workoutDetail.notesMax'));
                    setNotes(value.slice(0, 220));
                  } else {
                    setDetailError('');
                    setNotes(value);
                  }
                }}
                style={[styles.input, styles.notesInput]}
                placeholder={t('workoutDetail.notesPlaceholder')}
                placeholderTextColor="#64748b"
                multiline
                maxLength={220}
              />
            </>
          ) : (
            <>
              <Text style={styles.workoutTitle}>{workout.title}</Text>
              <Text style={styles.workoutDate}>{workout.date}</Text>
              {workout.sourceTemplateId ? (
                <Text style={styles.templateBadge}>{t('workoutDetail.templateBadge')}</Text>
              ) : null}
              {workout.notes ? (
                <Text style={styles.workoutNotes}>{workout.notes}</Text>
              ) : (
                <Text style={styles.workoutNotesPlaceholder}>
                  {t('workoutDetail.notesEmpty')}
                </Text>
              )}
            </>
          )}
        </GlassCard>

        {/* KNAPPAR: TA BORT / REDIGERA / SPARA */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Trash2 size={16} color="#fee2e2" />
            <Text style={styles.buttonText}>{t('workoutDetail.deleteCta')}</Text>
          </TouchableOpacity>

          {isEditing ? (
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                accessibilityLabel={t('workoutDetail.saveA11y')}
                accessibilityRole="button"
              >
                <Save size={16} color="#022c22" />
                <Text style={styles.buttonTextDark}>{t('common.save')}</Text>
              </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={() => {
                setTitle(workout.title);
                setDate(workout.date);
                setNotes(workout.notes ?? '');
                setIsEditing(true);
              }}
              accessibilityLabel={t('workoutDetail.editA11y')}
              accessibilityRole="button"
            >
              <Pencil size={16} color="#e5e7eb" />
              <Text style={styles.buttonText}>{t('common.edit')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {workout.sourceTemplateId ? (
          <TouchableOpacity
            style={[styles.button, styles.saveButton, { marginTop: 6 }]}
            onPress={() => {
              Haptics.selectionAsync();
              router.replace({
                pathname: '/workout/quick-workout',
                params: {
                  title: workout.title,
                  color: workout.color,
                  templateId: workout.sourceTemplateId,
                },
              });
            }}
              accessibilityLabel={t('workoutDetail.startRoutine')}
            accessibilityRole="button"
          >
            <Play size={16} color="#022c22" />
            <Text style={styles.buttonTextDark}>{t('workoutDetail.startRoutine')}</Text>
          </TouchableOpacity>
        ) : null}
        {detailError ? (
          <Text style={[styles.label, { color: '#fca5a5', marginBottom: 4 }]}>
            {detailError}
          </Text>
        ) : null}

        {/* ÖVNINGAR I PASSET */}
        <GlassCard style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>{t('workoutDetail.exercisesTitle')}</Text>
          <Text style={styles.sectionSub}>
            {t('workoutDetail.exercisesSub')}
          </Text>

          {(!workout.exercises || workout.exercises.length === 0) && (
            <Text style={styles.emptyText}>
              {t('workoutDetail.exercisesEmpty')}
            </Text>
          )}

          {workout.exercises && workout.exercises.length > 0 && (
            <View style={styles.exerciseList}>
              {editedExercises.map((ex) => (
                <View key={ex.id} style={styles.exerciseItem}>
                  <TouchableOpacity
                    onPress={() => handleExercisePress(ex.name)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.exerciseHeaderRow}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      {(() => {
                        const setCount =
                          ex.performedSets?.length ??
                          (Number.isFinite(ex.sets) ? ex.sets : undefined);
                        const repsValue =
                          ex.reps ??
                          ex.performedSets?.find((ps) => ps.reps !== undefined)?.reps ??
                          '–';
                        const weightValue =
                          Number.isFinite(ex.weight)
                            ? ex.weight
                            : ex.performedSets?.find((ps) => Number.isFinite(ps.weight))?.weight ??
                              '–';
                        return (
                          <Text style={styles.exerciseMetaRight}>
                            {setCount ?? '–'} set · {repsValue} reps · {weightValue} kg
                          </Text>
                        );
                      })()}
                    </View>
                    <Text style={styles.exerciseMeta}>
                      Vikt: {Number.isFinite(ex.weight) ? ex.weight : '–'} kg
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.performedSetsBox}>
                    <View style={styles.performedSetsHeader}>
                      <ListChecks size={14} color={colors.textSoft} />
                      <Text style={styles.performedSetsTitle}>{t('workoutDetail.loggedSets')}</Text>
                    </View>
                    {ex.performedSets?.map((s, idx) => (
                      <View key={`${ex.id}-${idx}`} style={styles.performedSetRow}>
                        <Text style={styles.performedSetLabel}>
                          {t('workoutDetail.setLabel', undefined, idx + 1)}
                        </Text>
                        <View style={styles.performedInputs}>
                          <TextInput
                            style={styles.performedInput}
                            value={String(s.reps)}
                            maxLength={6}
                            onChangeText={(t) =>
                              setEditedExercises((prev) =>
                                prev.map((item) =>
                                  item.id === ex.id
                                    ? {
                                        ...item,
                                        performedSets: item.performedSets?.map(
                                          (ps, pIdx) =>
                                            pIdx === idx ? { ...ps, reps: t } : ps
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            accessibilityLabel={t('workoutDetail.changeRepsA11y')}
                            accessibilityRole="adjustable"
                            keyboardType="numeric"
                          />
                          <TextInput
                            style={styles.performedInput}
                            value={String(s.weight)}
                            maxLength={5}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/[^0-9.,-]/g, '').replace(',', '.');
                              const num = parseFloat(cleaned);
                              if (Number.isNaN(num) || num < 0) {
                                setDetailError(t('workoutDetail.weightNonNegative'));
                                return;
                              }
                              setDetailError('');
                              setEditedExercises((prev) =>
                                prev.map((item) =>
                                  item.id === ex.id
                                    ? {
                                        ...item,
                                        performedSets: item.performedSets?.map(
                                          (ps, pIdx) =>
                                            pIdx === idx
                                              ? { ...ps, weight: num }
                                              : ps
                                        ),
                                      }
                                    : item
                                )
                              );
                            }}
                            accessibilityLabel={t('workoutDetail.changeWeightA11y')}
                            accessibilityRole="adjustable"
                            keyboardType="numeric"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.selectionAsync();
                              setDetailError('');
                              handleSave();
                            }}
                            style={[
                              styles.setButton,
                              { paddingHorizontal: 10, paddingVertical: 8 },
                            ]}
                            activeOpacity={0.9}
                            accessibilityLabel={t('common.save')}
                            accessibilityRole="button"
                          >
                            <Text style={styles.setButtonText}>
                              {t('common.save')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </GlassCard>
      </ScrollView>
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backButton: {
  },
  screenTitle: {
    color: colors.textMain,
    fontSize: 18,
    fontWeight: '700',
  },

  card: {
    marginTop: 4,
  },

  workoutTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  workoutDate: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
  },
  workoutNotes: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  workoutNotesPlaceholder: {
    color: '#6b7280',
    fontSize: 13,
    fontStyle: 'italic',
  },

  label: {
    color: '#e5e7eb',
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: 'white',
    borderWidth: 1,
    borderColor: '#1f2937',
    fontSize: 14,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  datePickerRow: {
    gap: 6,
  },
  datePickerField: {
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
  datePickerText: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  dateQuickRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dateQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  dateQuickChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#14532d',
  },
  dateQuickChipText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  dateQuickChipTextActive: {
    color: '#bbf7d0',
    fontWeight: '700',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  deleteButton: {
    backgroundColor: '#7f1d1d',
  },
  editButton: {
    backgroundColor: '#1f2937',
  },
  saveButton: {
    backgroundColor: '#22c55e',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  buttonTextDark: {
    color: '#022c22',
    fontWeight: '700',
    fontSize: 13,
  },

  sectionTitle: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 12,
  },

  exerciseList: {
    marginTop: 4,
    gap: 8,
  },
  exerciseItem: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseMetaRight: {
    color: colors.textSoft,
    fontSize: 11,
  },
  exerciseMeta: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
  },
  exerciseMetaVolume: {
    color: colors.accentBlue,
    fontSize: 11,
    marginTop: 2,
  },
  performedSetsBox: {
    marginTop: 8,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 8,
    gap: 6,
  },
  performedSetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performedSetsTitle: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  performedSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  performedSetLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  performedSetValue: {
    color: colors.textMain,
    fontSize: 12,
  },
  performedInputs: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  setButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setButtonDone: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  setButtonText: {
    color: colors.textMain,
    fontSize: 12,
    fontWeight: '800',
  },
  setButtonTextDone: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '800',
  },
  performedInput: {
    minWidth: 60,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.textMain,
    fontSize: 12,
  },

  notFoundText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  templateBadge: {
    fontSize: 11,
    color: '#c4b5fd',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#312e81',
  },
});
