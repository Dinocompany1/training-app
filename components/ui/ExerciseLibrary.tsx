import React from 'react';
import { Dumbbell } from 'lucide-react-native';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, typography } from '../../constants/theme';

type ExerciseGroup = {
  group: string;
  exercises: { name: string; imageUri?: string }[];
};

type Props = {
  groups: ExerciseGroup[];
  selectedNames: string[];
  onToggle: (name: string, group: string) => void;
  style?: ViewStyle;
  showMuscleChips?: boolean;
  muscleGroups?: string[];
  selectedMuscleFor?: (name: string) => string | undefined;
  onSelectMuscle?: (name: string, muscle: string) => void;
};

export default function ExerciseLibrary({
  groups,
  selectedNames,
  onToggle,
  style,
  showMuscleChips = false,
  muscleGroups = [],
  selectedMuscleFor,
  onSelectMuscle,
}: Props) {
  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAZlBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////8F6kJ+AAAAIHRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyoyXwAAAChJREFUGNNjYGBgZGJmBgYWiJmFlYGRiYGRiZWBgYkB4hkZiRmBgYGRAAAWCwH4kG3QjgAAAABJRU5ErkJggg==';
  return (
    <View style={[styles.listBox, style]}>
      <Text style={styles.sectionLabel}>Tryck för att lägga till eller ta bort övningar.</Text>

      {groups.map((group) => (
        <View key={group.group} style={styles.groupSection}>
          <View style={styles.groupHeader}>
            <View style={styles.groupIconCircle}>
              <Dumbbell size={14} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.groupTitle}>{group.group}</Text>
              <Text style={styles.groupSubtitle}>{group.exercises.length} övningar</Text>
            </View>
          </View>

          <View style={styles.groupListCard}>
            {group.exercises.map((ex, index) => {
              const name = typeof ex === 'string' ? ex : ex.name;
              const imageUri = typeof ex === 'string' ? undefined : ex.imageUri;
              const isSelected = selectedNames.includes(name);
              const isLast = index === group.exercises.length - 1;
              const currentMuscle = selectedMuscleFor?.(name);

              return (
                <View key={name} style={{ marginBottom: isLast ? 0 : 0 }}>
                  <TouchableOpacity
                    style={[
                      styles.exerciseRow,
                      !isLast && styles.exerciseRowDivider,
                      isSelected && styles.exerciseRowActive,
                    ]}
                    onPress={() => onToggle(name, group.group)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Välj övning ${name}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.exerciseNameWrapper}>
                      <View
                        style={[
                          styles.exerciseDot,
                    isSelected && styles.exerciseDotActive,
                  ]}
                />
                  <Image
                    source={{ uri: imageUri || placeholder }}
                    style={styles.exerciseThumb}
                    contentFit="cover"
                  />
                 <Text
                   style={[
                     styles.exerciseName,
                     isSelected && styles.exerciseNameActive,
                    ]}
                  >
                    {name}
                  </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.exerciseTagPill}>
                        <Text style={styles.exerciseTag}>Vald</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {showMuscleChips && isSelected && muscleGroups.length > 0 && onSelectMuscle && (
                    <View style={styles.muscleRow}>
                      {muscleGroups.map((mg) => {
                        const active = currentMuscle === mg;
                        return (
                          <TouchableOpacity
                            key={`${name}-${mg}`}
                            style={[
                              styles.muscleChip,
                              active && styles.muscleChipActive,
                            ]}
                            onPress={() => onSelectMuscle(name, mg)}
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
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listBox: {
    marginTop: 10,
    backgroundColor: '#050b16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 10,
  },
  sectionLabel: {
    color: colors.textMain,
    fontSize: 12,
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
    color: colors.textMain,
    fontSize: 13,
    fontWeight: '700',
  },
  groupSubtitle: {
    color: colors.textSoft,
    fontSize: 11,
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
    fontWeight: '700',
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.cardBorder,
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
  exerciseTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.iconBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  exerciseTag: {
    ...typography.micro,
    color: '#bbf7d0',
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
  },
  muscleChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBright + '26',
  },
  muscleChipText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  muscleChipTextActive: {
    color: colors.textMain,
    fontWeight: '700',
  },
});
