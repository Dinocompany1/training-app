import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Clock, Dumbbell, ListChecks, Palette, PlusCircle, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import EmptyState from '../../components/ui/EmptyState';
import ExerciseDetailCard from '../../components/ui/ExerciseDetailCard';
import ExerciseLibrary from '../../components/ui/ExerciseLibrary';
import GlassCard from '../../components/ui/GlassCard';
import NeonButton from '../../components/ui/NeonButton';
import { EXERCISE_LIBRARY } from '../../constants/exerciseLibrary';
import { colors, gradients, typography } from '../../constants/theme';
import { Template, useWorkouts } from '../../context/WorkoutsContext';
import { toast } from '../../utils/toast';

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

const MUSCLE_GROUPS = ['Bröst', 'Rygg', 'Ben', 'Axlar', 'Armar', 'Övrigt'];
const COLOR_OPTIONS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#e11d48'];

// Enkel id-generator (ingen uuid / crypto)
const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeNumeric = (value: string) => value.replace(/[^0-9.,-]/g, '').replace(',', '.');
const sanitizeReps = (value: string) => value.replace(/[^0-9xX/–-]/g, '').slice(0, 6);
const parseWeightInput = (value: string) => {
  if (!value) return 0;
  const normalized = value.replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? NaN : Math.max(0, num);
};
const normalizeMuscleGroup = (value?: string) => {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : 'Övrigt';
};

const todayString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const buildExercisesFromTemplate = (params: { templateId?: string }, templates: Template[]) => {
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
  const { addWorkout, addTemplate, templates, customExercises } = useWorkouts();
  const params = useLocalSearchParams<{ title?: string; color?: string; templateId?: string }>();

  const resolvedTemplate = useMemo(() => {
    if (!params.templateId || !Array.isArray(templates)) return undefined;
    return templates.find((t) => t.id === params.templateId);
  }, [params.templateId, templates]);

  const defaultColor =
    (params.color && typeof params.color === 'string' && params.color) ||
    resolvedTemplate?.color ||
    '#a855f7';

  const defaultTitle =
    (params.title && typeof params.title === 'string' && params.title) ||
    resolvedTemplate?.name ||
    (params.templateId ? 'Rutinpass' : 'Snabbpass');

  const [title, setTitle] = useState<string>(defaultTitle);
  const [color, setColor] = useState<string>(defaultColor);
  const [templateColor, setTemplateColor] = useState<string>(defaultColor);

  const [startTimestamp] = useState<number>(Date.now());
  const elapsedSeconds = useWorkoutTimer(startTimestamp);
  const formattedTime = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState<string>(defaultTitle);
  const templateColors = ['#a855f7', '#22c55e', '#3b82f6', '#f97316', '#ec4899'];

  const [inputError, setInputError] = useState('');
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
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

  const [exercises, setExercises] = useState<QuickExercise[]>(() =>
    buildExercisesFromTemplate(params, templates)
  );

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

  const { totalSets } = useMemo(() => {
    let total = 0;
    for (const ex of exercises) total += ex.sets.length;
    return { totalSets: total };
  }, [exercises]);

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
        setInputError('Vikt måste vara siffror (använd punkt eller komma).');
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
        name: `Ny övning ${prev.length + 1}`,
        muscleGroup: 'Övrigt',
        sets: [{ id: generateId(), reps: '10', weight: '' }],
      },
    ]);
  };

  const addExerciseFromName = (name: string, muscle?: string) => {
    setExercises((prev) => [
      ...prev,
      {
        id: generateId(),
        name,
        muscleGroup: muscle || 'Övrigt',
        sets: [{ id: generateId(), reps: '10', weight: '' }],
      },
    ]);
  };

  const toggleExerciseFromLibrary = (name: string, group?: string) => {
    setExercises((prev) => {
      const exists = prev.find((e) => e.name === name);
      if (exists) {
        return prev.filter((e) => e.name !== name);
      }
      return [
        ...prev,
        {
          id: generateId(),
          name,
          muscleGroup: normalizeMuscleGroup(group || 'Övrigt'),
          sets: [{ id: generateId(), reps: '10', weight: '', done: false }],
        },
      ];
    });
  };

  const handleAddCustomExercise = () => {
    const trimmed = customName.trim();
    if (!trimmed) {
      Alert.alert('Fel', 'Ange ett namn på övningen.');
      return;
    }
    addExerciseFromName(trimmed, 'Övrigt');
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

  const handleFinish = () => {
    Haptics.selectionAsync();
    const hasInvalidWeight = exercises.some((ex) =>
      ex.sets.some((s) => Number.isNaN(parseWeightInput(s.weight)))
    );
    if (hasInvalidWeight) {
      setInputError('Vikt måste vara siffror (använd punkt eller komma).');
      return;
    }
    setInputError('');

    Alert.alert('Avsluta pass', 'Vill du spara passet?', [
      { text: 'Fortsätt träna', style: 'cancel' },
      { text: 'Ja, spara', style: 'default', onPress: saveWorkout },
    ]);
  };

  const saveWorkout = () => {
    if (!title.trim()) {
      Alert.alert('Fel', 'Passet måste ha en titel.');
      return;
    }
    const hasInvalidWeight = exercises.some((ex) =>
      ex.sets.some((s) => Number.isNaN(parseWeightInput(s.weight)))
    );
    if (hasInvalidWeight) {
      Alert.alert('Fel', 'Vikt måste vara siffror (använd punkt eller komma).');
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
        muscleGroup: normalizeMuscleGroup(ex.muscleGroup),
        performedSets: parsedSets,
      };
    });

    setLastWorkoutExercises(workoutExercises);

    const workout = {
      id: generateId(),
      title,
      date: todayString(),
      notes: notes.trim(),
      color,
      durationMinutes,
      exercises: workoutExercises,
      isCompleted: true,
      sourceTemplateId:
        params.templateId && typeof params.templateId === 'string' ? params.templateId : undefined,
    };

    addWorkout(workout);

    Alert.alert(
      'Snyggt jobbat! 💪',
      `Du genomförde ${workoutExercises.length} övningar och ${totalSets} set på ungefär ${durationMinutes} min.`,
      [
        {
          text: 'Spara som rutin',
          onPress: () => {
            setTemplateName(title);
            setTemplateColor(color);
            setTemplateModalVisible(true);
          },
        },
        {
          text: 'Till hem',
          onPress: () => router.replace('/'),
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert('Avbryt pass', 'Vill du verkligen avbryta passet? Ingenting sparas.', [
      { text: 'Fortsätt träna', style: 'cancel' },
      {
        text: 'Avbryt pass',
        style: 'destructive',
        onPress: () => router.back(),
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
              muscleGroup: normalizeMuscleGroup(ex.muscleGroup),
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
    toast('Sparad som rutin');
    Alert.alert('Sparad rutin', 'Passet sparades som rutin.', [
      { text: 'OK', onPress: () => router.replace('/') },
    ]);
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <Modal
          visible={templateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTemplateModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Spara som rutin</Text>
              <Text style={styles.modalSub}>Justera namn och färg innan du sparar.</Text>
              <TextInput
                style={styles.modalInput}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="Namn på rutin"
                placeholderTextColor={colors.textSoft}
              />
              <TextInput
                style={styles.modalInput}
                value={templateColor}
                onChangeText={setTemplateColor}
                placeholder="Färg (hex, t.ex. #a855f7)"
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
                  <Text style={styles.modalCancelText}>Avbryt</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSave]}
                  onPress={handleSaveTemplate}
                >
                  <Text style={styles.modalSaveText}>Spara</Text>
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
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <View style={[styles.colorDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>Pågående pass</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.timerPill}>
                <Clock size={14} color="#e5e7eb" />
                <Text style={styles.timerText}>{formattedTime}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Planerade set</Text>
              <Text style={styles.progressLabel}>{totalSets} set i passet</Text>
            </View>

            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: totalSets > 0 ? '100%' : '4%' },
                ]}
              />
            </View>

            <Text style={styles.progressHint}>
              Lägg till set och fyll reps/vikt per set för varje övning.
            </Text>
          </GlassCard>

          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Passinfo</Text>
                <Text style={styles.cardText}>Namnge ditt spontanpass och lägg till anteckningar.</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowColorPicker((prev) => !prev);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.colorCircle, { backgroundColor: color || '#3b82f6' }]}>
                  <Palette size={16} color="#0b1120" />
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
                    accessibilityLabel={`Välj färg ${c}`}
                    accessibilityRole="button"
                  />
                ))}
              </View>
            )}
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Titel för passet"
              placeholderTextColor={colors.textSoft}
            />
            <TextInput
              style={[styles.notesInput, { marginTop: 8 }]}
              value={notes}
              onChangeText={(t) => {
                if (t.length > 220) {
                  setNotesError('Max 220 tecken i anteckningar.');
                  setNotes(t.slice(0, 220));
                } else {
                  setNotesError('');
                  setNotes(t);
                }
              }}
              placeholder="Anteckningar (valfritt)"
              placeholderTextColor={colors.textSoft}
              multiline
              maxLength={220}
            />
            {notesError ? <Text style={styles.errorText}>{notesError}</Text> : null}
          </GlassCard>

          <GlassCard style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.iconCircle}>
                  <Dumbbell size={18} color={colors.accentBlue} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Välj övningar</Text>
                  <Text style={styles.cardText}>
                    Lägg till övningar från listan eller egna innan du fyller set.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipPrimary]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowExerciseList((prev) => !prev);
                  setShowCustomInput(false);
                  setShowTemplatePicker(false);
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
                  setShowExerciseList(false);
                  setShowTemplatePicker(false);
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

            {showCustomInput && (
              <View style={styles.customExerciseBox}>
                <Text style={styles.customLabel}>Namn på egen övning</Text>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  style={styles.input}
                  placeholder="Ex. Bulgarian split squats"
                  placeholderTextColor={colors.textSoft}
                />
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton, { marginTop: 6 }]}
                  onPress={handleAddCustomExercise}
                  activeOpacity={0.9}
                >
                  <Text style={styles.buttonText}>Lägg till</Text>
                </TouchableOpacity>
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
                  Välj en sparad rutin – läggs till direkt i passet.
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
                          {active && <CheckCircle2 size={16} color={colors.accentGreen} />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            <View style={styles.selectedBox}>
            <Text style={styles.sectionLabel}>Valda övningar</Text>
            {exercises.length === 0 ? (
              <EmptyState
                title="Inga övningar ännu"
                subtitle="Öppna biblioteket eller lägg till en egen för att börja."
                ctaLabel="Välj övningar"
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
                      <Text style={styles.removeText}>Ta bort</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {exercises.length > 0 && (
              <NeonButton
                title="✅ Klar med val av övningar"
                onPress={() => {
                  setShowDetails(true);
                  setShowExerciseList(false);
                  setShowCustomInput(false);
                }}
                variant="green"
                style={styles.confirmButton}
                accessibilityLabel="Klar med val av övningar"
                accessibilityRole="button"
              />
            )}
          </GlassCard>

          {showDetails && exercises.length > 0 && (
            <View style={styles.listContainer}>
              {exercises.map((ex) => (
                <ExerciseDetailCard
                  key={ex.id}
                  name={ex.name}
                  muscleGroups={MUSCLE_GROUPS}
                  currentMuscle={ex.muscleGroup}
                  onSelectMuscle={(mg) =>
                    setExercises((prev) =>
                      prev.map((item) => (item.id === ex.id ? { ...item, muscleGroup: mg } : item))
                    )
                  }
                  sets={ex.sets.map((s) => ({ reps: s.reps, weight: s.weight }))}
                  onChangeSet={(setIdx, field, value) =>
                    updateSetField(ex.id, ex.sets[setIdx].id, field, value)
                  }
                  onAddSet={() => addSetToExercise(ex.id)}
                />
              ))}

              <TouchableOpacity style={styles.addExerciseButton} onPress={addExercise} activeOpacity={0.9}>
                <Text style={styles.addExerciseText}>+ Lägg till övning</Text>
              </TouchableOpacity>

              {inputError ? <Text style={styles.errorText}>{inputError}</Text> : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <NeonButton title="✅ Avsluta pass" onPress={handleFinish} toastMessage="Avslutar pass" />
          <Text style={styles.finishButtonSub}>{totalSets} set i passet</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pageContent: {
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0f172a',
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
    gap: 8,
    marginLeft: 8,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  timerText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 12,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  progressCard: {
    marginBottom: 12,
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
    borderRadius: 999,
    backgroundColor: '#020617',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#a855f7',
  },
  progressHint: {
    ...typography.micro,
    marginTop: 6,
    color: colors.textSoft,
  },
  card: {
    marginTop: 12,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardText: {
    ...typography.caption,
    color: colors.textMain,
    marginTop: 2,
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
    borderRadius: 12,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionChipPrimary: {
    backgroundColor: colors.accentGreen,
  },
  actionChipSecondary: {
    backgroundColor: colors.accentBlue,
  },
  actionChipTertiary: {
    backgroundColor: colors.primary,
  },
  actionChipTextPrimary: {
    ...typography.caption,
    color: '#022c22',
  },
  actionChipTextSecondary: {
    ...typography.caption,
    color: '#0b1120',
  },
  actionChipTextTertiary: {
    ...typography.caption,
    color: '#0b1120',
  },
  customExerciseBox: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 14,
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
    backgroundColor: '#020617',
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
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
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
    ...typography.bodyBold,
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
    color: '#f97316',
  },
  notesInput: {
    minHeight: 70,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    color: colors.textMain,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  addExerciseButton: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
    paddingVertical: 10,
    alignItems: 'center',
  },
  addExerciseText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  errorText: {
    ...typography.caption,
    color: '#fca5a5',
    marginTop: 6,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0b1220',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
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
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    color: colors.textMain,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCancel: {
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  modalSave: {
    borderColor: colors.accentGreen,
    backgroundColor: '#14532d',
  },
  modalCancelText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  modalSaveText: {
    ...typography.caption,
    color: '#bbf7d0',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#020617',
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
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    color: colors.textMain,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
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
    color: '#e0f2fe',
    marginTop: 2,
  },
});
