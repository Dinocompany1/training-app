// app/create-template.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ListChecks, Palette, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../../components/ui/GlassCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import BackPill from '../../components/ui/BackPill';
import { colors, gradients } from '../../constants/theme';
import { Template, useWorkouts } from '../../context/WorkoutsContext';
import { toast } from '../../utils/toast';
import { useTranslation } from '../../context/TranslationContext';
import { createId } from '../../utils/id';

const WORKOUT_COLORS = [
  { label: 'Blå (Push)', value: '#3b82f6' },
  { label: 'Gul (Pull)', value: '#f59e0b' },
  { label: 'Röd (Ben)', value: '#ef4444' },
  { label: 'Grön', value: '#10b981' },
  { label: 'Lila', value: '#8b5cf6' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Orange', value: '#f97316' },
];

type TemplateExerciseInput = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
};

export default function CreateTemplateScreen() {
  const router = useRouter();
  const { addTemplate } = useWorkouts();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(
    WORKOUT_COLORS[0].value
  );
  const [exercises, setExercises] = useState<TemplateExerciseInput[]>([
    {
      id: createId('ct-ex'),
      name: '',
      sets: '3',
      reps: '8–10',
      weight: '',
    },
  ]);
  const [error] = useState('');

  const handleAddExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        id: createId('ct-ex'),
        name: '',
        sets: '3',
        reps: '8–10',
        weight: '',
      },
    ]);
  };

  const handleUpdateExercise = (
    id: string,
    field: keyof TemplateExerciseInput,
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  const handleRemoveExercise = (id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  };

  const handleSaveTemplate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast(t('templateBuilder.nameError'));
      return;
    }

    const cleanedExercises = exercises
      .filter((ex) => ex.name.trim() !== '')
      .map((ex) => ({
        name: ex.name.trim(),
        sets: ex.sets ? Number(ex.sets) : 0,
        reps: ex.reps || '',
        weight: ex.weight ? Number(ex.weight.replace(',', '.')) : 0,
        muscleGroup: t('exercises.groups.Övrigt'),
      }));

    if (cleanedExercises.length === 0) {
      toast(t('templateBuilder.exerciseError'));
      return;
    }

    const newTemplate: Template = {
      id: createId('tpl'),
      name: trimmedName,
      description: description.trim(),
      color: selectedColor,
      exercises: cleanedExercises,
    };

    addTemplate(newTemplate);

    toast(t('templateBuilder.savedToast'));
    router.back();
  };

  return (
    <LinearGradient
      colors={gradients.appBackground}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.backRow}>
              <BackPill onPress={() => router.back()} />
            </View>
            {/* HEADER */}
            <View style={styles.headerRow}>
              <View style={styles.iconCircle}>
                <ListChecks color="#e0f2fe" size={24} />
              </View>
              <ScreenHeader
                title={t('templateBuilder.title')}
                subtitle={t('templateBuilder.subtitle')}
                compact
                tone="blue"
                style={styles.headerTitle}
              />
            </View>

            {/* BASINFO */}
            <GlassCard style={styles.card}>
              <Text style={styles.label}>{t('templateBuilder.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('templateBuilder.namePlaceholder')}
                placeholderTextColor={colors.textSoft}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.label, { marginTop: 10 }]}>
                {t('templateBuilder.descLabel')}
              </Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder={t('templateBuilder.descPlaceholder')}
                placeholderTextColor={colors.textSoft}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* FÄRG */}
              <View style={styles.colorHeaderRow}>
                <View style={styles.colorLabelRow}>
                  <Palette size={16} color={colors.primary} />
                  <Text style={[styles.label, { marginLeft: 6 }]}>
                    {t('templateBuilder.colorLabel')}
                  </Text>
                </View>
                <Text style={styles.colorHint}>
                  {t('templateBuilder.colorHint')}
                </Text>
              </View>

              <View style={styles.colorRow}>
                {WORKOUT_COLORS.map((c) => {
                  const active = c.value === selectedColor;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.value },
                        active && styles.colorCircleActive,
                      ]}
                      onPress={() => setSelectedColor(c.value)}
                    />
                  );
                })}
              </View>
            </GlassCard>

            {/* ÖVNINGAR */}
            <GlassCard style={styles.card}>
              <View style={styles.exHeaderRow}>
                <Text style={styles.sectionTitle}>{t('templateBuilder.exTitle')}</Text>
                <TouchableOpacity onPress={handleAddExercise}>
                  <Text style={styles.addExerciseText}>{t('templateBuilder.addExercise')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSub}>
                {t('templateBuilder.exSub')}
              </Text>

              {exercises.map((ex, index) => (
                <View key={ex.id} style={styles.exerciseCard}>
                  <View style={styles.exerciseHeaderRow}>
                    <Text style={styles.exerciseIndex}>
                      #{index + 1}{' '}
                      <Text style={styles.exerciseIndexLabel}>{t('templateBuilder.exLabel')}</Text>
                    </Text>
                    {exercises.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveExercise(ex.id)}
                      >
                        <Trash2 size={16} color="#fca5a5" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder={t('templateBuilder.exPlaceholder')}
                    placeholderTextColor={colors.textSoft}
                    value={ex.name}
                    onChangeText={(t) =>
                      handleUpdateExercise(ex.id, 'name', t)
                    }
                  />

                  <View style={styles.inlineRow}>
                    <View style={styles.inlineCol}>
                      <Text style={styles.labelSmall}>{t('exerciseDetail.sets')}</Text>
                      <TextInput
                        style={styles.inlineInput}
                        placeholder={t('templateBuilder.setsPlaceholder')}
                        placeholderTextColor={colors.textSoft}
                        keyboardType="number-pad"
                        value={ex.sets}
                        onChangeText={(t) =>
                          handleUpdateExercise(ex.id, 'sets', t)
                        }
                      />
                    </View>

                    <View style={styles.inlineCol}>
                      <Text style={styles.labelSmall}>{t('exerciseDetail.reps')}</Text>
                      <TextInput
                        style={styles.inlineInput}
                        placeholder={t('templateBuilder.repsPlaceholder')}
                        placeholderTextColor={colors.textSoft}
                        value={ex.reps}
                        onChangeText={(t) =>
                          handleUpdateExercise(ex.id, 'reps', t)
                        }
                      />
                    </View>

                    <View style={styles.inlineCol}>
                      <Text style={styles.labelSmall}>{t('exerciseDetail.bestWeight')} ({t('common.kg').toLowerCase()})</Text>
                      <TextInput
                        style={styles.inlineInput}
                        placeholder={t('templateBuilder.weightPlaceholder')}
                        placeholderTextColor={colors.textSoft}
                        keyboardType="numeric"
                        value={ex.weight}
                        onChangeText={(t) =>
                          handleUpdateExercise(ex.id, 'weight', t)
                        }
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveTemplate}
                activeOpacity={0.95}
              >
                <Text style={styles.saveButtonText}>{t('templateBuilder.saveCta')}</Text>
              </TouchableOpacity>
          {error ? (
            <Text style={{ color: '#fca5a5', fontSize: 12, marginTop: 6 }}>
              {error}
            </Text>
          ) : null}
        </GlassCard>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  backRow: {
    paddingBottom: 6,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  headerTitle: {
    flex: 1,
    marginBottom: 0,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  title: {
    color: colors.textMain,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 2,
  },

  card: {
    marginBottom: 12,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
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
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },

  colorHeaderRow: {
    marginTop: 12,
    marginBottom: 4,
  },
  colorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorHint: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#020617',
  },
  colorCircleActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
  },

  exHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    color: colors.textSoft,
    fontSize: 11,
    marginBottom: 8,
    marginTop: 2,
  },
  addExerciseText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  exerciseCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    padding: 10,
    marginTop: 6,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseIndex: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 13,
  },
  exerciseIndexLabel: {
    color: colors.textSoft,
    fontWeight: '400',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  inlineCol: {
    flex: 1,
  },
  labelSmall: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2,
  },
  inlineInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 13,
  },

  saveButton: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  saveButtonText: {
    color: '#022c22',
    fontWeight: '800',
    fontSize: 14,
  },
});
