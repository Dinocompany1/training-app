import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';

export type DetailSet = { reps: string; weight: number | string };

type Props = {
  name: string;
  muscleGroups?: string[];
  currentMuscle?: string;
  onSelectMuscle?: (muscle: string) => void;
  sets: DetailSet[];
  onChangeSet: (index: number, field: 'reps' | 'weight', value: string) => void;
  onAddSet: () => void;
};

export default function ExerciseDetailCard({
  name,
  muscleGroups = [],
  currentMuscle,
  onSelectMuscle,
  sets,
  onChangeSet,
  onAddSet,
}: Props) {
  const { t } = useTranslation();

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
            <Text style={styles.setLabel}>{t('workoutDetail.setLabel', undefined, idx + 1)}</Text>
            <View style={styles.setInputs}>
              <View style={styles.detailInputGroup}>
                <Text style={styles.detailLabel}>{t('exerciseDetail.reps')}</Text>
                <TextInput
                  style={styles.detailInput}
                  keyboardType="numeric"
                  value={String(setItem.reps)}
                  onChangeText={(v) => onChangeSet(idx, 'reps', v)}
                />
              </View>
              <View style={styles.detailInputGroup}>
                <Text style={styles.detailLabel}>{t('common.kg')}</Text>
                <TextInput
                  style={styles.detailInput}
                  keyboardType="numeric"
                  value={String(setItem.weight)}
                  onChangeText={(v) => onChangeSet(idx, 'weight', v)}
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
    borderRadius: 14,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
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
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  muscleChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#14532d',
  },
  muscleChipText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  muscleChipTextActive: {
    color: '#bbf7d0',
    fontWeight: '700',
  },
  setList: {
    gap: 8,
    marginTop: 6,
  },
  setRow: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  setLabel: {
    color: colors.textSoft,
    fontSize: 12,
  },
  setInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  detailInputGroup: {
    flex: 1,
  },
  detailLabel: {
    color: colors.textSoft,
    fontSize: 11,
    marginBottom: 2,
  },
  detailInput: {
    backgroundColor: '#020617',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: 'white',
    borderWidth: 1,
    borderColor: '#1f2937',
    fontSize: 12,
  },
  addSetButton: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#0b1220',
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
