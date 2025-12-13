// app/schedule-workout.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Dumbbell,
  Palette,
  PlusCircle,
  ListChecks,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
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
import { Calendar, DateObject } from 'react-native-calendars';
import GlassCard from '../components/ui/GlassCard';
import { colors, gradients, typography } from '../constants/theme';
import { Exercise, Template, useWorkouts } from '../context/WorkoutsContext';
import ExerciseDetailCard from '../components/ui/ExerciseDetailCard';
import { toast } from '../utils/toast';
import ExerciseLibrary from '../components/ui/ExerciseLibrary';

const MUSCLE_MAP: Record<string, string> = {
  Bröst: 'Bröst',
  Rygg: 'Rygg',
  Ben: 'Ben',
  Axlar: 'Axlar',
  Armar: 'Armar',
};

const normalizeMuscleGroup = (name: string) => MUSCLE_MAP[name] || 'Övrigt';
const MUSCLE_GROUPS = ['Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Övrigt'];

// Fördefinierade övningar – grupperade
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';

const COLOR_OPTIONS = [
  '#3b82f6', // blå
  '#22c55e', // grön
  '#f97316', // orange
  '#e11d48', // röd/rosa
  '#a855f7', // lila
];

export default function ScheduleWorkoutScreen() {
  const router = useRouter();
  const { addWorkout, templates, customExercises } = useWorkouts();

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
  const [calendarSeedDate, setCalendarSeedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const openDatePicker = (seed?: string) => {
    const next = seed && isValidDate(seed) ? seed : new Date().toISOString().slice(0, 10);
    setCalendarSeedDate(next);
    setShowCalendarPicker(true);
  };

  // Datum-hantering: flera datum för samma pass
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateInput, setDateInput] = useState(todayStr);
  const [dates, setDates] = useState<string[]>([todayStr]);
  const quickDates = [
    todayStr,
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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

  const applyTemplate = (t: Template) => {
    setSelectedTemplateId(t.id);
    setTitle((prev) => (prev ? prev : t.name));
    setColor(t.color);
    const mapped = t.exercises.map((ex) => ({
      id: `${ex.name}-${Date.now()}-${Math.random()}`,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      muscleGroup: ex.muscleGroup || 'Övrigt',
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
    const d = new Date(value);
    return !isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
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
      setDateError('Ange datum som YYYY-MM-DD');
      return;
    }
    setDateError('');
    if (dates.includes(trimmed)) {
      Alert.alert('Redan tillagt', 'Detta datum finns redan i listan.');
      return;
    }
    setDates((prev) => [...prev, trimmed].sort());
    setDateInput(trimmed);
  };

  const handleCalendarSelect = (day: DateObject) => {
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
      Alert.alert('Fel', 'Du måste ha minst ett datum.');
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
        muscleGroup: normalizeMuscleGroup(group?.group || ''),
        performedSets: buildInitialPerformedSets(1, '10', 0),
      };
      setSelectedExercises((prev) => [...prev, newExercise]);
    }
  };

  const handleAddCustomExercise = () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      Alert.alert('Fel', 'Ange ett namn på din övning.');
      return;
    }

    const newExercise: Exercise = {
      id: Date.now().toString() + trimmed,
      name: trimmed,
      sets: 1,
      reps: '10',
      weight: 0,
      muscleGroup: 'Övrigt',
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
      setTitleError('Passet måste ha ett namn.');
      return;
    }
    setTitleError('');

    const finalDatesSet = new Set(dates);
    if (isValidDate(dateInput)) {
      finalDatesSet.add(dateInput.trim());
    }
    const finalDates = Array.from(finalDatesSet).sort();

    if (finalDates.length === 0) {
      Alert.alert('Inga datum', 'Lägg till minst ett datum för passet.');
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert('Inga övningar', 'Lägg till minst en övning.');
      return;
    }

    if (selectedExercises.some((ex) => Number.isNaN(Number(ex.weight)))) {
      setWeightError('Vikt måste vara siffror (använd punkt eller komma).');
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

    toast('Planerade pass sparade');
    Alert.alert('Sparat', 'Dina framtida pass har planerats.', [
      { text: 'Stanna här', style: 'default' },
      {
        text: 'Öppna kalender',
        style: 'default',
        onPress: () => router.replace('/(tabs)/calendar'),
      },
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
          <Text style={styles.title}>Planera framtida pass</Text>
          <Text style={styles.subtitle}>
            Skapa ett pass, välj ett eller flera datum och fyll i dina övningar.
          </Text>

          {/* CARD 1 – PASSINFO + DATUM */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Passinfo</Text>
                <Text style={styles.cardText}>
                  Namn, datum och anteckningar för detta planerade pass.
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
                    accessibilityLabel={`Välj färg ${c}`}
                    accessibilityRole="button"
                  />
                ))}
              </View>
            )}

            {/* Namn */}
            <Text style={styles.label}>Titel</Text>
            <TextInput
              value={title}
              onChangeText={(t) => {
                setTitleError('');
                setTitle(t.slice(0, 60));
              }}
              style={styles.input}
              placeholder="Ex. Push, Ben, Helkropp"
              placeholderTextColor="#64748b"
              maxLength={60}
            />
            {titleError ? (
              <Text style={styles.errorText}>{titleError}</Text>
            ) : null}

            {/* Datum + lägg till fler datum */}
            <Text style={[styles.label, { marginTop: 10 }]}>Datum</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateInputButton}
                onPress={() => openDatePicker(dateInput)}
                accessibilityLabel="Öppna datumväljare"
                accessibilityRole="button"
              >
                <CalendarIcon size={16} color={colors.textMain} />
                <Text style={styles.dateInputText}>
                  {dateInput || 'Välj datum'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addDateButton}
                onPress={addDate}
                activeOpacity={0.9}
                accessibilityLabel="Lägg till datum"
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
                  accessibilityLabel={`Snabbval datum ${d === todayStr ? 'Idag' : 'Imorgon'}`}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.quickDateText,
                      dateInput === d && styles.quickDateTextActive,
                    ]}
                  >
                    {d === todayStr ? 'Idag' : d}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.datePickerChip}
                onPress={() => openDatePicker(dateInput)}
              >
                <Text style={styles.quickDateText}>Välj annat datum</Text>
              </TouchableOpacity>
            </View>

            {dates.length > 0 && (
              <View style={styles.datesList}>
                <Text style={styles.sectionLabel}>Valda datum</Text>
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
                      accessibilityLabel={`Ändra datum ${d}`}
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
                    accessibilityLabel={`Ta bort datum ${d}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.removeText}>Ta bort</Text>
                  </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Anteckningar */}
            <Text style={[styles.label, { marginTop: 10 }]}>Anteckningar</Text>
            <TextInput
              value={notes}
              onChangeText={(t) => {
                if (t.length > 220) {
                  setNotesError('Max 220 tecken.');
                  setNotes(t.slice(0, 220));
                } else {
                  setNotesError('');
                  setNotes(t);
                }
              }}
              style={[styles.input, styles.notesInput]}
              placeholder="Ex. fokus, tempo, mål med passet..."
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
                  <Text style={styles.cardTitle}>Välj övningar</Text>
                  <Text style={styles.cardText}>
                    Lägg till övningar i passet – från listan eller egna.
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

            <TouchableOpacity
              style={[styles.actionChip, styles.actionChipTertiary]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowTemplatePicker((prev) => !prev);
                setShowExerciseList(false);
                setShowCustomInput(false);
              }}
              accessibilityLabel="Välj rutin"
              accessibilityRole="button"
            >
              <ListChecks size={14} color="#0b1120" />
                <Text style={styles.actionChipTextTertiary}>Rutiner</Text>
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
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    handleAddCustomExercise();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.buttonText}>Lägg till övning</Text>
                </TouchableOpacity>
              </View>
            )}

            {showTemplatePicker && (
              <View style={styles.templateLibrary}>
                <Text style={styles.sectionLabel}>
                  Välj en sparad rutin – samma stil som övningslistan.
                </Text>
                <View style={styles.templateListCard}>
                  {templates.length === 0 ? (
                    <View style={styles.templateEmpty}>
                      <Text style={styles.emptyText}>
                        Inga sparade rutiner ännu. Spara ett pass som rutin för att se det här.
                      </Text>
                    </View>
                  ) : (
                    templates.map((t, idx) => {
                      const active = t.id === selectedTemplateId;
                      const isLast = idx === templates.length - 1;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[
                            styles.templateRow,
                            !isLast && styles.templateRowDivider,
                            active && styles.templateRowActive,
                          ]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            applyTemplate(t);
                          }}
                          activeOpacity={0.85}
                          accessibilityLabel={`Välj rutin ${t.name}`}
                          accessibilityRole="button"
                        >
                          <View style={styles.templateLeft}>
                            <View
                              style={[
                                styles.templateDot,
                                { backgroundColor: t.color || colors.primary },
                              ]}
                            />
                            <View>
                              <Text style={styles.templateName}>{t.name}</Text>
                              {t.description ? (
                                <Text style={styles.templateMeta} numberOfLines={1}>
                                  {t.description}
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
                <Text style={styles.buttonText}>
                  Klar med val av övningar
                </Text>
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
            </GlassCard>
          )}

          {/* SPARA PLANERADE PASS */}
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSavePlannedWorkouts}
              activeOpacity={0.9}
              accessibilityLabel="Spara planerade pass"
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Spara planerade pass</Text>
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
              <Text style={styles.modalTitle}>Välj datum</Text>
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
                accessibilityLabel="Stäng datumväljare"
                accessibilityRole="button"
              >
                <Text style={styles.modalCloseText}>Stäng</Text>
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
});
