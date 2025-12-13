// app/routine-builder.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2,
  Dumbbell,
  Palette,
  PlusCircle,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../components/ui/GlassCard';
import { colors, gradients, typography } from '../constants/theme';
import { Exercise, Template, useWorkouts } from '../context/WorkoutsContext';
import { toast } from '../utils/toast';
import ExerciseLibrary from '../components/ui/ExerciseLibrary';
import ExerciseDetailCard from '../components/ui/ExerciseDetailCard';

const sanitizeNumeric = (value: string) =>
  value.replace(/[^0-9.,-]/g, '').replace(',', '.');
const sanitizeReps = (value: string) =>
  value.replace(/[^0-9xX/–-]/g, '').replace(/--+/g, '-');
const normalizeMuscleGroup = (group: string) => group || 'Övrigt';
const MUSCLE_GROUPS = ['Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Övrigt'];
const buildInitialPerformedSets = (sets: number, reps: string, weight: number) =>
  Array.from(
    { length: Math.max(1, Number.isFinite(sets) ? sets : 1) },
    () => ({
      reps: reps || '10',
      weight: Number.isFinite(weight) ? weight : 0,
      done: false,
    })
  );

  const updateSetField = (
    id: string,
    setIndex: number,
    field: 'reps' | 'weight',
    value: string
  ) => {
    const clean = field === 'weight' ? sanitizeNumeric(value) : value;

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
                [field]: field === 'weight' ? Number(clean) || 0 : clean,
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
            first?.weight !== undefined && !Number.isNaN(Number(first.weight))
              ? Number(first.weight)
              : ex.weight,
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
            nextSets[0]?.weight !== undefined && !Number.isNaN(Number(nextSets[0].weight))
              ? Number(nextSets[0].weight)
              : ex.weight,
        };
      })
    );
  };

// Fördefinierade övningar – grupperade
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';

const COLOR_OPTIONS = [
  '#3b82f6', // blå
  '#22c55e', // grön
  '#f97316', // orange
  '#e11d48', // röd/rosa
  '#a855f7', // lila
];

export default function RoutineBuilderScreen() {
  const router = useRouter();
  const { addTemplate, customExercises } = useWorkouts();

  // Card 1 – rutininfo
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<string>('#3b82f6');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [formError, setFormError] = useState('');
  const [weightError, setWeightError] = useState('');

  // Card 2 – övningar
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // När man trycker "Klar" för att gå till set/reps/vikt-läget
  const [showDetails, setShowDetails] = useState(false);

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

  const toggleExerciseFromLibrary = (name: string) => {
    const exists = selectedExercises.find((e) => e.name === name);
    if (exists) {
      setSelectedExercises((prev) => prev.filter((e) => e.name !== name));
    } else {
      const groupEntry = mergedLibrary.find((g) =>
        g.exercises.some((ex) => ex.name === name)
      );
      const newExercise: Exercise = {
        id: Date.now().toString() + name,
        name,
        sets: 3,
        reps: '10',
        weight: 0,
        muscleGroup: normalizeMuscleGroup(groupEntry?.group || 'Övrigt'),
      };
      setSelectedExercises((prev) => [...prev, newExercise]);
    }
  };

  const handleAddCustomExercise = () => {
    Haptics.selectionAsync();
    const trimmed = customName.trim();
    if (!trimmed) {
      Alert.alert('Fel', 'Ange ett namn på din övning.');
      return;
    }

    const newExercise: Exercise = {
      id: Date.now().toString() + trimmed,
      name: trimmed,
      sets: 3,
      reps: '10',
      weight: 0,
      muscleGroup: 'Övrigt',
    };

    setSelectedExercises((prev) => [...prev, newExercise]);
    setCustomName('');
    setShowCustomInput(false);
  };

  const handleRemoveExercise = (id: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const handleConfirmExercises = () => {
    Haptics.selectionAsync();
    if (selectedExercises.length === 0) {
      Alert.alert('Inga övningar', 'Lägg till minst en övning först.');
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
    setFormError('');
    setWeightError('');

    const updateNumeric = (prevVal: number, incoming: string) => {
      const cleaned = sanitizeNumeric(incoming);
      if (cleaned.trim() === '') return 0;
      const num = parseFloat(cleaned);
      if (Number.isNaN(num) || num < 0) {
        setWeightError('Vikt och set måste vara 0 eller större.');
        return prevVal;
      }
      return num;
    };

    setSelectedExercises((prev) =>
      prev.map((ex) =>
        ex.id === id
          ? {
              ...ex,
              [field]:
                field === 'name'
                  ? value
                  : field === 'reps'
                  ? sanitizeReps(value)
                  : field === 'sets'
                  ? Math.max(0, Math.round(updateNumeric(ex.sets, value)))
                  : updateNumeric(ex.weight, value),
            }
          : ex
      )
    );
  };

  const handleSaveRoutine = () => {
    Haptics.selectionAsync();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      Alert.alert('Fel', 'Rutinen måste ha ett namn.');
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert('Inga övningar', 'Lägg till minst en övning i rutinen.');
      return;
    }

    const invalidExercise = selectedExercises.find(
      (ex) => ex.sets < 0 || ex.weight < 0 || !ex.name.trim()
    );
    if (invalidExercise) {
      setFormError('Kolla så att varje övning har namn och icke-negativa värden.');
      return;
    }

    const template: Template = {
      id: Date.now().toString(),
      name: trimmedTitle,
      description: notes.trim() || undefined,
      color,
      exercises: selectedExercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        muscleGroup: normalizeMuscleGroup(ex.muscleGroup?.trim() || 'Övrigt'),
      })),
    };

    addTemplate(template);

    toast('Rutin sparad');
    Alert.alert('Sparat', 'Din rutin har sparats.', [
      {
        text: 'OK',
        onPress: () => router.replace('/(tabs)/add-workout'),
      },
    ]);
  };

  return (
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
          <Text style={styles.title}>Skapa rutin</Text>
          <Text style={styles.subtitle}>
            Bygg ett återanvändbart pass med en färg och övningar du älskar.
          </Text>

          {/* CARD 1 – RUTININFO */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Rutininfo</Text>
                <Text style={styles.cardText}>
                  Namnge din rutin och välj en färg som representerar passet.
                </Text>
              </View>

              {/* FÄRGCIRKEL HÖGER UPPE */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowColorPicker((prev) => !prev);
                }}
                activeOpacity={0.8}
                accessibilityLabel="Välj färg för rutin"
                accessibilityRole="button"
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
                  accessibilityLabel={`Välj färg ${c}`}
                  accessibilityRole="button"
                />
              ))}
            </View>
          )}

            {/* Namn */}
            <Text style={styles.label}>Namn</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Ex. Push, Ben, Helkropp"
              placeholderTextColor="#64748b"
            />

            {/* Anteckningar */}
            <Text style={[styles.label, { marginTop: 10 }]}>Anteckningar</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.notesInput]}
              placeholder="Ex. fokus, tempo, känsla..."
              placeholderTextColor="#64748b"
              multiline
            />
          </GlassCard>

          {/* CARD 2 – VÄLJ ÖVNINGAR */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconCircle}>
                  <Dumbbell size={18} color={colors.accentBlue} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Välj övningar</Text>
                  <Text style={styles.cardText}>
                    Lägg till övningar i rutinen – från listan eller egna.
                  </Text>
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
                accessibilityLabel="Öppna övningsbibliotek"
                accessibilityRole="button"
              >
                <PlusCircle size={14} color="#022c22" />
                <Text style={styles.actionChipTextPrimary}>Välj övning</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipSecondary]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCustomInput((prev) => !prev);
                }}
                accessibilityLabel="Lägg till egen övning"
                accessibilityRole="button"
              >
                <PlusCircle size={14} color="#0f172a" />
                <Text style={styles.actionChipTextSecondary}>Egen övning</Text>
              </TouchableOpacity>
            </View>

            {/* EGEN ÖVNING INPUT */}
            {showCustomInput && (
              <View style={styles.customExerciseBox}>
                <Text style={styles.label}>Namn på egen övning</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  style={styles.input}
                  placeholder="Ex. Bulgarian split squats"
                  placeholderTextColor="#64748b"
                />
                <View style={styles.muscleRow}>
                  {MUSCLE_GROUPS.map((mg) => {
                    const active = false; // enkel default, custom övning får välja vid sparning
                    return (
                      <TouchableOpacity
                        key={`custom-${mg}`}
                        style={[
                          styles.muscleChip,
                          active && styles.muscleChipActive,
                        ]}
                        onPress={() => {
                          // sätt default muskelgrupp på custom övning
                          setSelectedExercises((prev) => [
                            ...prev,
                            {
                              id: Date.now().toString() + customName + mg,
                              name: customName.trim() || 'Övning',
                              sets: 3,
                              reps: '10',
                              weight: 0,
                              muscleGroup: mg,
                            },
                          ]);
                          setCustomName('');
                          setShowCustomInput(false);
                        }}
                        accessibilityLabel={`Välj muskelgrupp ${mg}`}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.muscleChipText,
                            active && styles.muscleChipTextActive,
                          ]}
                        >
                          {mg}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleAddCustomExercise}
                >
                  <Text style={styles.buttonText}>Lägg till övning</Text>
                </TouchableOpacity>
                {weightError ? (
                  <Text style={[styles.sectionLabel, { color: '#fca5a5' }]}>
                    {weightError}
                  </Text>
                ) : null}
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
                showMuscleChips
                muscleGroups={MUSCLE_GROUPS}
                selectedMuscleFor={(name) =>
                  selectedExercises.find((e) => e.name === name)?.muscleGroup
                }
                onSelectMuscle={(name, mg) =>
                  setSelectedExercises((prev) =>
                    prev.map((ex) =>
                      ex.name === name ? { ...ex, muscleGroup: mg } : ex
                    )
                  )
                }
              />
            )}

            {/* VALDA ÖVNINGAR (namnlista) */}
            <View style={styles.selectedBox}>
              <Text style={styles.sectionLabel}>Valda övningar</Text>
              {selectedExercises.length === 0 ? (
                <Text style={styles.emptyText}>
                  Inga övningar ännu. Välj från listan eller lägg till en egen.
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
                      <Text style={styles.removeText}>Ta bort</Text>
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
                <Text style={styles.buttonText}>Klar med val av övningar</Text>
              </TouchableOpacity>
            )}
          </GlassCard>

          {/* DETALJKORT – SETS / REPS / VIKT */}
          {showDetails && selectedExercises.length > 0 && (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Detaljer för övningar</Text>
              <Text style={styles.cardText}>
                Fyll i reps och vikt per set. Lägg till fler set vid behov.
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

              {weightError ? (
                <Text style={[styles.cardText, { color: '#fca5a5', marginTop: 8 }]}>
                  {weightError}
                </Text>
              ) : null}
            </GlassCard>
          )}

          {formError ? (
            <Text style={[styles.cardText, { color: '#fca5a5', marginTop: 4 }]}>
              {formError}
            </Text>
          ) : null}

          {/* SPARA-KNAPP */}
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveRoutine}
          >
            <Text style={styles.buttonText}>Spara rutin</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: colors.accentGreen,
  },
  actionChipSecondary: {
    backgroundColor: colors.accentBlue,
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
    marginBottom: 4,
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
    backgroundColor: colors.success, // Starta pass: grön
  },

  button: {
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.primary, // Planera: lila
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    ...typography.bodyBold,
    color: '#0b1120',
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  muscleChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#14532d',
  },
  muscleChipText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '600',
  },
  muscleChipTextActive: {
    color: '#bbf7d0',
    fontWeight: '700',
  },
});
