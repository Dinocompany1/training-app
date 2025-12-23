// app/all-exercises.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import GlassCard from '../components/ui/GlassCard';
import EmptyState from '../components/ui/EmptyState';
import { colors, gradients, typography } from '../constants/theme';
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';
import { useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';

export default function AllExercisesScreen() {
  const { customExercises, addCustomExercise } = useWorkouts();
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const { t } = useTranslation();
  const translateGroup = (g: string) => t(`exercises.groups.${g}`, g);
  const translateName = (n: string) => t(`exercises.names.${n}`, n);
  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAZlBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////8F6kJ+AAAAIHRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyoyXwAAAChJREFUGNNjYGBgZGJmBgYWiJmFlYGRiYGRiZWBgYkB4hkZiRmBgYGRAAAWCwH4kG3QjgAAAABJRU5ErkJggg==';
  const mergedLibrary = useMemo(() => {
    const base = EXERCISE_LIBRARY.map((g) => ({
      ...g,
      exercises: [...g.exercises],
    }));
    customExercises.forEach((ex) => {
      const found = base.find((g) => g.group === ex.muscleGroup);
      if (found) {
        found.exercises.push({ name: ex.name, imageUri: ex.imageUri });
      } else {
        base.push({
          group: ex.muscleGroup,
          exercises: [{ name: ex.name, imageUri: ex.imageUri }],
        });
      }
    });
    return base;
  }, [customExercises]);
  const groupNames = useMemo(() => mergedLibrary.map((g) => g.group), [mergedLibrary]);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState(groupNames[0] || '');
  const [showAddForm, setShowAddForm] = useState(false);

  const handlePressExercise = (name: string) => {
    setSelectedExercise((prev) => (prev === name ? null : name));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={gradients.appBackground}
        style={styles.full}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{t('library.title')}</Text>
          <Text style={styles.subtitle}>
            {t('library.subtitle')}
          </Text>

        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.addToggle}
            onPress={() => setShowAddForm((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={t('library.addFormToggleA11y')}
          >
            <Text style={styles.sectionTitle}>
              {showAddForm ? t('library.hideForm') : t('library.showForm')}
            </Text>
            <Text style={styles.sectionSub}>
              {t('library.formInfo')}
            </Text>
          </TouchableOpacity>

              {showAddForm && (
                <View style={styles.addForm}>
                  <Text style={styles.fieldLabel}>{t('library.nameLabel')}</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={t('library.namePlaceholder')}
                    placeholderTextColor={colors.textSoft}
                    style={styles.input}
                  />
              <Text style={[styles.fieldLabel, { marginTop: 8 }]}>{t('library.groupLabel')}</Text>
              <View style={styles.chipRow}>
                {groupNames.map((g) => {
                  const active = newGroup === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setNewGroup(g)}
                      accessibilityRole="button"
                      accessibilityLabel={t('library.selectGroup', translateGroup(g))}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {translateGroup(g)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.saveButton, { marginTop: 10 }]}
                onPress={() => {
                  const trimmed = newName.trim();
                  if (!trimmed) {
                    Alert.alert(t('library.errorTitle'), t('library.errorName'));
                    return;
                  }
                  const exists = mergedLibrary.some((g) =>
                    g.exercises.some((ex) =>
                      (typeof ex === 'string' ? ex === trimmed : ex.name === trimmed)
                    )
                  );
                  if (exists) {
                    Alert.alert(t('library.errorExistsTitle'), t('library.errorExistsBody'));
                    return;
                  }
                  addCustomExercise({
                    name: trimmed,
                    muscleGroup: newGroup,
                  });
                  setNewName('');
                  Alert.alert(t('library.addedTitle'), t('library.addedBody', { name: trimmed, group: newGroup }));
                }}
              >
                <Text style={styles.saveButtonText}>{t('library.addCta')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {mergedLibrary.map((group) => (
          <GlassCard key={group.group} style={styles.card}>
            {/* Rubrik för muskelgrupp */}
            <View style={styles.groupHeader}>
              <View style={styles.groupIconCircle}>
                <Dumbbell size={16} color={colors.accentBlue} />
              </View>
              <View>
                <Text style={styles.groupTitle}>{translateGroup(group.group)}</Text>
                <View style={styles.groupMetaRow}>
                  <Text style={styles.groupSubtitle}>
                    {t('library.metaCount', group.exercises.length)}
                  </Text>
                  <View style={styles.groupPill}>
                    <Text style={styles.groupPillText}>{t('library.discover')}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Lodrät lista med övningar */}
            <View style={styles.exerciseList}>
              {group.exercises.length === 0 ? (
                <EmptyState
                  title={t('library.emptyTitle')}
                  subtitle={t('library.emptySubtitle')}
                  ctaLabel={t('library.emptyCta')}
                  onPressCta={() => setShowAddForm(true)}
                />
              ) : (
                group.exercises.map((ex, index) => {
                  const name = typeof ex === 'string' ? ex : ex.name;
                  const displayName = translateName(name);
                  const isSelected = selectedExercise === name;
                  const isLast = index === group.exercises.length - 1;

                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => handlePressExercise(name)}
                      activeOpacity={0.8}
                      style={[
                        styles.exerciseRow,
                        !isLast && styles.exerciseRowDivider,
                        isSelected && styles.exerciseRowActive,
                      ]}
                      accessibilityLabel={t('library.selectExercise', displayName)}
                      accessibilityRole="button"
                    >
                      <View style={styles.exerciseNameWrapper}>
                        <View style={[styles.exerciseDot, isSelected && styles.exerciseDotActive]} />
                        <Text
                          style={[
                            styles.exerciseName,
                            isSelected && styles.exerciseNameActive,
                          ]}
                          accessible={false}
                        >
                          {displayName}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={styles.exerciseTag}>
                          {t('library.selectedTag')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </GlassCard>
        ))}

        {selectedExercise && (
          <View style={styles.footerInfo}>
            <Text style={styles.footerLabel}>{t('library.footerSelected')}</Text>
            <Text style={styles.footerValue}>{translateName(selectedExercise)}</Text>
            <Text style={styles.footerHint}>
              {t('library.footerHint')}
            </Text>
          </View>
        )}
        </ScrollView>
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
  sectionTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
    marginBottom: 8,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  card: {
    marginTop: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  groupIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  groupTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  groupSubtitle: {
    ...typography.caption,
    color: colors.textSoft,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.iconBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  groupPillText: {
    ...typography.micro,
    color: colors.textMain,
    letterSpacing: 0.3,
  },
  exerciseList: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
  },
  exerciseRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  exerciseThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: colors.backgroundSoft,
  },
  exerciseTag: {
    ...typography.micro,
    color: '#bbf7d0',
  },
  footerInfo: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  footerLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  footerValue: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 2,
  },
  footerHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#111827',
    color: colors.textMain,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: colors.backgroundSoft,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.textMain,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0b1024',
    fontWeight: '800',
    fontSize: 13,
  },
  addToggle: {
    paddingVertical: 4,
  },
  addForm: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    gap: 6,
  },
});
