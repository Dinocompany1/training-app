import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors, radii, typography } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

export type DetailSet = { reps: string; weight: number | string; done?: boolean; setId?: string };

type Props = {
  exerciseId?: string;
  name: string;
  muscleGroups?: string[];
  currentMuscle?: string;
  onSelectMuscle?: (muscle: string) => void;
  sets: DetailSet[];
  onChangeSet: (index: number, field: 'reps' | 'weight', value: string) => void;
  onAddSet: () => void;
  onCompleteSet?: (index: number) => void;
  focusTargetKey?: string | null;
  onFocusHandled?: () => void;
};

export default function ExerciseDetailCard({
  exerciseId,
  name,
  muscleGroups = [],
  currentMuscle,
  onSelectMuscle,
  sets,
  onChangeSet,
  onAddSet,
  onCompleteSet,
  focusTargetKey,
  onFocusHandled,
}: Props) {
  const { t } = useTranslation();
  const inputRefs = React.useRef<Record<string, TextInput | null>>({});

  React.useEffect(() => {
    if (!focusTargetKey) return;
    const input = inputRefs.current[focusTargetKey];
    if (!input) return;
    const id = setTimeout(() => {
      input.focus();
      onFocusHandled?.();
    }, 30);
    return () => clearTimeout(id);
  }, [focusTargetKey, onFocusHandled]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{name}</Text>
      </View>

      {muscleGroups.length > 0 && onSelectMuscle && (
        <View style={styles.muscleRow}>
          {muscleGroups.map((mg) => {
            const active = currentMuscle === mg;
            return (
              <TouchableOpacity
                key={`${name}-${mg}`}
                style={[styles.muscleChip, active && styles.muscleChipActive]}
                onPress={() => onSelectMuscle(mg)}
                accessibilityLabel={t('routineBuilder.selectMuscle', undefined, mg)}
                accessibilityRole="button"
              >
                <Text style={[styles.muscleChipText, active && styles.muscleChipTextActive]}>
                  {mg}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.setList}>
        {sets.map((setItem, idx) => (
          <View key={`${name}-set-${idx}`} style={styles.setRow}>
            <View style={styles.setHeader}>
              <Text style={styles.setLabel}>{t('workoutDetail.setLabel', undefined, idx + 1)}</Text>
              {onCompleteSet ? (
                <TouchableOpacity
                  style={[styles.setDonePill, setItem.done && styles.setDonePillActive]}
                  onPress={() => onCompleteSet(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={t('quick.setDoneA11y', undefined, idx + 1)}
                >
                  <Text style={[styles.setDoneText, setItem.done && styles.setDoneTextActive]}>
                    {t('quick.setDone')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.setInputs}>
              <View style={styles.detailInputGroup}>
                <Text style={styles.detailLabel}>{t('exerciseDetail.reps')}</Text>
                <TextInput
                  style={styles.detailInput}
                  keyboardType="numeric"
                  value={String(setItem.reps)}
                  onChangeText={(v) => onChangeSet(idx, 'reps', v)}
                  ref={(ref) => {
                    if (!exerciseId || !setItem.setId) return;
                    inputRefs.current[`${exerciseId}:${setItem.setId}:reps`] = ref;
                  }}
                />
              </View>
              <View style={styles.detailInputGroup}>
                <Text style={styles.detailLabel}>{t('common.kg')}</Text>
                <TextInput
                  style={styles.detailInput}
                  keyboardType="numeric"
                  value={String(setItem.weight)}
                  onChangeText={(v) => onChangeSet(idx, 'weight', v)}
                  ref={(ref) => {
                    if (!exerciseId || !setItem.setId) return;
                    inputRefs.current[`${exerciseId}:${setItem.setId}:weight`] = ref;
                  }}
                />
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addSetButton}
          onPress={onAddSet}
          activeOpacity={0.9}
          accessibilityLabel={t('routineBuilder.addSet')}
          accessibilityRole="button"
        >
          <Text style={styles.addSetText}>{t('routineBuilder.addSet')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: { ...typography.bodyBold, color: colors.textMain },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
  },
  muscleChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  muscleChipText: {
    ...typography.micro,
    color: colors.textSoft,
  },
  muscleChipTextActive: {
    color: colors.textMain,
    fontWeight: '700',
  },
  setList: {
    gap: 8,
    marginTop: 6,
  },
  setRow: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  setDonePill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDonePillActive: {
    borderColor: colors.success,
    backgroundColor: colors.primarySoft,
  },
  setDoneText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  setDoneTextActive: {
    color: colors.textMain,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  detailInputGroup: {
    flex: 1,
  },
  detailLabel: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 2,
  },
  detailInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.textMain,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    fontSize: 12,
  },
  addSetButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addSetText: {
    color: colors.textMain,
    fontSize: 12,
    fontWeight: '700',
  },
});
