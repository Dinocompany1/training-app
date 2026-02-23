// app/all-exercises.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Trash2, MoveRight, Star } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/ui/GlassCard';
import EmptyState from '../components/ui/EmptyState';
import ScreenHeader from '../components/ui/ScreenHeader';
import { colors, gradients, inputs, layout, spacing, typography } from '../constants/theme';
import { EXERCISE_LIBRARY } from '../constants/exerciseLibrary';
import { useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';
import { translateExerciseGroup, translateExerciseName } from '../utils/exerciseTranslations';
import { toast } from '../utils/toast';
import storage from '../utils/safeStorage';
import { sortWorkoutsByRecencyDesc } from '../utils/workoutRecency';

const LIBRARY_FAVORITES_KEY = 'library-favorites-v1';
type SortMode = 'recent' | 'mostUsed' | 'az';

export default function AllExercisesScreen() {
  const {
    customExercises,
    addCustomExercise,
    removeCustomExercise,
    customGroups,
    addCustomGroup,
    removeCustomGroup,
    workouts,
  } = useWorkouts();
  const [selectedExercises, setSelectedExercises] = useState<
    { name: string; group: string }[]
  >([]);
  const { t } = useTranslation();
  const translateGroup = useCallback((g: string) => translateExerciseGroup(t, g), [t]);
  const translateName = useCallback((n: string) => translateExerciseName(t, n), [t]);

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
    customGroups.forEach((g) => {
      if (!base.find((b) => b.group === g)) {
        base.push({ group: g, exercises: [] });
      }
    });
    return base;
  }, [customExercises, customGroups]);
  const groupNames = useMemo(
    () => Array.from(new Set([...mergedLibrary.map((g) => g.group)])),
    [mergedLibrary]
  );
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [customGroup, setCustomGroup] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [exerciseError, setExerciseError] = useState('');
  const [moveGroup, setMoveGroup] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<'all' | string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);

  // Om vald grupp tas bort, rensa valet
  React.useEffect(() => {
    if (newGroup && !groupNames.includes(newGroup)) {
      setNewGroup('');
    }
    if (moveGroup && !groupNames.includes(moveGroup)) {
      setMoveGroup('');
    }
  }, [groupNames, newGroup, moveGroup]);

  React.useEffect(() => {
    storage
      .getItem(LIBRARY_FAVORITES_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setFavoriteKeys(parsed.filter((v): v is string => typeof v === 'string'));
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    storage.setItem(LIBRARY_FAVORITES_KEY, JSON.stringify(favoriteKeys)).catch(() => {});
  }, [favoriteKeys]);

  const toExerciseKey = useCallback((name: string, group: string) => `${name.trim().toLowerCase()}::${group.trim().toLowerCase()}`, []);

  const handleRemoveGroup = (name: string) => {
    removeCustomGroup(name);
    setNewGroup((prev) => {
      if (prev === name) {
        const fallback =
          mergedLibrary.find((g) => g.group !== name)?.group || '';
        return fallback;
      }
      return prev;
    });
  };

  const handlePressExercise = (name: string, group: string) => {
    setSelectedExercises((prev) => {
      const exists = prev.find(
        (p) => p.name === name && p.group === group
      );
      if (exists) {
        return prev.filter((p) => !(p.name === name && p.group === group));
      }
      return [...prev, { name, group }];
    });
  };

  const toggleFavorite = (name: string, group: string) => {
    const key = toExerciseKey(name, group);
    setFavoriteKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const latestPerformanceByExercise = useMemo(() => {
    const map = new Map<string, { reps: string; weight: number; date: string }>();
    const completed = sortWorkoutsByRecencyDesc((workouts || []).filter((w) => w.isCompleted));

    completed.forEach((workout) => {
      (workout.exercises || []).forEach((ex) => {
        const key = ex.name.trim().toLowerCase();
        if (!key || map.has(key)) return;
        const firstSet = ex.performedSets?.[0];
        map.set(key, {
          reps: firstSet?.reps || ex.reps || '-',
          weight:
            firstSet?.weight != null && Number.isFinite(Number(firstSet.weight))
              ? Number(firstSet.weight)
              : Number.isFinite(Number(ex.weight))
              ? Number(ex.weight)
              : 0,
          date: workout.date,
        });
      });
    });
    return map;
  }, [workouts]);

  const usageStatsByExercise = useMemo(() => {
    const map = new Map<string, { count: number; lastDate: string }>();
    const completed = (workouts || []).filter((w) => w.isCompleted);
    completed.forEach((workout) => {
      (workout.exercises || []).forEach((ex) => {
        const key = ex.name.trim().toLowerCase();
        if (!key) return;
        const current = map.get(key);
        if (!current) {
          map.set(key, { count: 1, lastDate: workout.date });
          return;
        }
        map.set(key, {
          count: current.count + 1,
          lastDate: current.lastDate > workout.date ? current.lastDate : workout.date,
        });
      });
    });
    return map;
  }, [workouts]);

  const displayGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return mergedLibrary
      .filter((group) => activeGroupFilter === 'all' || group.group === activeGroupFilter)
      .map((group) => {
        const filteredExercises = group.exercises.filter((ex) => {
          const name = (typeof ex === 'string' ? ex : ex.name) || '';
          if (!query) return true;
          return translateName(name).toLowerCase().includes(query) || name.toLowerCase().includes(query);
        });
        const sortedExercises = [...filteredExercises].sort((a, b) => {
          const aName = typeof a === 'string' ? a : a.name;
          const bName = typeof b === 'string' ? b : b.name;
          if (sortMode === 'az') {
            return translateName(aName).localeCompare(translateName(bName), 'sv');
          }
          if (sortMode === 'mostUsed') {
            const aCount = usageStatsByExercise.get(aName.trim().toLowerCase())?.count ?? 0;
            const bCount = usageStatsByExercise.get(bName.trim().toLowerCase())?.count ?? 0;
            if (aCount !== bCount) return bCount - aCount;
            return translateName(aName).localeCompare(translateName(bName), 'sv');
          }
          const aDate = usageStatsByExercise.get(aName.trim().toLowerCase())?.lastDate ?? '';
          const bDate = usageStatsByExercise.get(bName.trim().toLowerCase())?.lastDate ?? '';
          if (aDate !== bDate) return bDate.localeCompare(aDate);
          return translateName(aName).localeCompare(translateName(bName), 'sv');
        });
        return { ...group, exercises: sortedExercises };
      })
      .filter((group) => group.exercises.length > 0 || !searchQuery.trim());
  }, [mergedLibrary, activeGroupFilter, searchQuery, translateName, sortMode, usageStatsByExercise]);

  const favoriteExercises = useMemo(() => {
    if (favoriteKeys.length === 0) return [];
    const query = searchQuery.trim().toLowerCase();
    const all = mergedLibrary.flatMap((group) =>
      group.exercises.map((ex) => {
        const name = typeof ex === 'string' ? ex : ex.name;
        return { name, group: group.group };
      })
    );
    return all
      .filter((item) => favoriteKeys.includes(toExerciseKey(item.name, item.group)))
      .filter((item) => activeGroupFilter === 'all' || item.group === activeGroupFilter)
      .filter((item) => {
        if (!query) return true;
        const translated = translateName(item.name).toLowerCase();
        return translated.includes(query) || item.name.toLowerCase().includes(query);
      });
  }, [favoriteKeys, mergedLibrary, toExerciseKey, activeGroupFilter, searchQuery, translateName]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={gradients.appBackground}
        style={styles.full}
      >
        <View style={styles.backRow}>
          <BackPill />
        </View>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader title={t('library.title')} subtitle={t('library.subtitle')} tone="teal" />
          <GlassCard style={styles.card}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('library.searchPlaceholder')}
              placeholderTextColor={colors.textSoft}
              style={styles.input}
            />
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, activeGroupFilter === 'all' && styles.filterChipActive]}
                onPress={() => setActiveGroupFilter('all')}
                accessibilityRole="button"
              >
                <Text style={[styles.filterChipText, activeGroupFilter === 'all' && styles.filterChipTextActive]}>
                  {t('library.filterAll')}
                </Text>
              </TouchableOpacity>
              {groupNames.map((g) => (
                <TouchableOpacity
                  key={`filter-${g}`}
                  style={[styles.filterChip, activeGroupFilter === g && styles.filterChipActive]}
                  onPress={() => setActiveGroupFilter(g)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.filterChipText, activeGroupFilter === g && styles.filterChipTextActive]}>
                    {translateGroup(g)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.sortRow}>
              <TouchableOpacity
                style={[styles.sortChip, sortMode === 'recent' && styles.sortChipActive]}
                onPress={() => setSortMode('recent')}
                accessibilityRole="button"
              >
                <Text style={[styles.sortChipText, sortMode === 'recent' && styles.sortChipTextActive]}>
                  {t('library.sortRecent')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, sortMode === 'mostUsed' && styles.sortChipActive]}
                onPress={() => setSortMode('mostUsed')}
                accessibilityRole="button"
              >
                <Text style={[styles.sortChipText, sortMode === 'mostUsed' && styles.sortChipTextActive]}>
                  {t('library.sortMostUsed')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, sortMode === 'az' && styles.sortChipActive]}
                onPress={() => setSortMode('az')}
                accessibilityRole="button"
              >
                <Text style={[styles.sortChipText, sortMode === 'az' && styles.sortChipTextActive]}>
                  {t('library.sortAtoZ')}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

        {favoriteExercises.length > 0 && (
          <GlassCard style={styles.card}>
            <View style={styles.groupHeader}>
              <View style={styles.groupIconCircle}>
                <Star size={16} color={colors.warning} />
              </View>
              <View>
                <Text style={styles.groupTitle}>{t('library.favoritesTitle')}</Text>
                <Text style={styles.groupSubtitle}>
                  {t('library.metaCount', undefined, favoriteExercises.length)}
                </Text>
              </View>
            </View>
            <View style={styles.exerciseList}>
              {favoriteExercises.map((item, index) => {
                const isLast = index === favoriteExercises.length - 1;
                const isSelected = selectedExercises.some((p) => p.name === item.name && p.group === item.group);
                const latest = latestPerformanceByExercise.get(item.name.trim().toLowerCase());
                return (
                  <TouchableOpacity
                    key={`fav-${item.group}-${item.name}`}
                    onPress={() => handlePressExercise(item.name, item.group)}
                    activeOpacity={0.8}
                    style={[
                      styles.exerciseRow,
                      !isLast && styles.exerciseRowDivider,
                      isSelected && styles.exerciseRowActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={styles.exerciseNameWrapper}>
                      <View style={[styles.exerciseDot, isSelected && styles.exerciseDotActive]} />
                      <View style={styles.exerciseTextCol}>
                        <Text style={[styles.exerciseName, isSelected && styles.exerciseNameActive]}>
                          {translateName(item.name)}
                        </Text>
                        <Text style={styles.exerciseMeta}>
                          {latest
                            ? t('library.latestMeta', undefined, {
                                reps: latest.reps,
                                weight: latest.weight,
                                date: latest.date,
                              })
                            : t('library.latestEmpty')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.exerciseActions}>
                      <TouchableOpacity
                        style={styles.favoriteBtn}
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleFavorite(item.name, item.group);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('library.toggleFavoriteA11y', undefined, translateName(item.name))}
                      >
                        <Star size={14} color={colors.warning} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickAddBtn, isSelected && styles.quickAddBtnActive]}
                        onPress={(event) => {
                          event.stopPropagation();
                          handlePressExercise(item.name, item.group);
                        }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={t('library.selectExercise', undefined, translateName(item.name))}
                      >
                        <Text style={[styles.quickAddBtnText, isSelected && styles.quickAddBtnTextActive]}>
                          {isSelected ? t('library.quickAdded') : t('library.quickAdd')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        )}

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
                  <View style={styles.formBlock}>
                    <Text style={styles.sectionTitle}>{t('library.groupLabel')}</Text>
                    <Text style={styles.sectionSub}>
                      {t('library.formGroupHint')}
                    </Text>
                    <View style={styles.chipRow}>
                      {groupNames.map((g) => {
                        return (
                          <View
                            key={g}
                            style={styles.chip}
                            pointerEvents="none"
                          >
                            <Text style={styles.chipText}>
                              {translateGroup(g)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <TextInput
                      value={customGroup}
                      onChangeText={setCustomGroup}
                      placeholder={t('library.customGroupPlaceholder')}
                      placeholderTextColor={colors.textSoft}
                      style={[styles.input, { marginTop: 8 }]}
                    />
                    <TouchableOpacity
                      style={styles.groupAddButton}
                      onPress={() => {
                        const trimmed = customGroup.trim();
                        if (!trimmed) {
                          setGroupError(t('library.errorGroup'));
                          return;
                        }
                        setGroupError('');
                        setCustomGroup('');
                        addCustomGroup(trimmed);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('library.addGroupCta')}
                    >
                      <Text style={styles.groupAddButtonText}>{t('library.addGroupCta')}</Text>
                    </TouchableOpacity>
                    {groupError ? <Text style={styles.formHint}>{groupError}</Text> : null}
                    {customGroups.length > 0 && (
                      <View style={styles.groupRemoveRow}>
                        {customGroups.map((g) => (
                          <TouchableOpacity
                            key={g}
                            style={styles.groupRemoveChip}
                            onPress={() => handleRemoveGroup(g)}
                            accessibilityRole="button"
                            accessibilityLabel={t('library.removeGroup', undefined, g)}
                          >
                            <Text style={styles.groupRemoveText}>{g}  ×</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.formBlock}>
                    <Text style={styles.sectionTitle}>{t('library.nameLabel')}</Text>
                    <Text style={styles.sectionSub}>
                      {t('library.formExerciseHint')}
                    </Text>
                    <Text style={[styles.fieldLabel, { marginTop: 2 }]}>
                      {t('library.groupLabel')}
                    </Text>
                    <View style={styles.chipRow}>
                      {groupNames.map((g) => {
                        const active = newGroup === g;
                        return (
                          <TouchableOpacity
                            key={`exercise-${g}`}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => {
                              setNewGroup(g);
                              setCustomGroup('');
                              setGroupError('');
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('library.selectGroup', undefined, translateGroup(g))}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {translateGroup(g)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      value={newName}
                      onChangeText={(val) => {
                        setNewName(val);
                        setExerciseError('');
                      }}
                      placeholder={t('library.namePlaceholder')}
                      placeholderTextColor={colors.textSoft}
                      style={styles.input}
                    />
                    {exerciseError ? (
                      <Text style={styles.formHint}>{exerciseError}</Text>
                    ) : null}
                    {groupError && !exerciseError ? (
                      <Text style={styles.formHint}>{groupError}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        {
                          marginTop: 10,
                          opacity:
                            newName.trim().length === 0 ||
                            (!newGroup && customGroup.trim().length === 0)
                              ? 0.6
                              : 1,
                        },
                      ]}
                      disabled={
                        newName.trim().length === 0 ||
                        (!newGroup && customGroup.trim().length === 0)
                      }
                      onPress={() => {
                        const trimmed = newName.trim();
                        if (!trimmed) {
                          setExerciseError(t('library.errorName'));
                          return;
                        }
                        const exists = mergedLibrary.some((g) =>
                          g.exercises.some((ex) =>
                            (typeof ex === 'string' ? ex === trimmed : ex.name === trimmed)
                          )
                        );
                        if (exists) {
                          setExerciseError(t('library.errorExistsBody'));
                          return;
                        }
                        const targetGroup =
                          customGroup.trim().length > 0 ? customGroup.trim() : newGroup;
                        if (!targetGroup) {
                          setExerciseError(t('library.errorGroup'));
                          return;
                        }
                        setGroupError('');
                        setExerciseError('');
                        addCustomExercise({
                          name: trimmed,
                          muscleGroup: targetGroup,
                        });
                        setNewName('');
                        setCustomGroup('');
                        if (!groupNames.includes(targetGroup)) {
                          setNewGroup(targetGroup);
                        }
                        const bodyTemplate = t(
                          'library.addedBody',
                          undefined,
                          { name: trimmed, group: targetGroup }
                        );
                        const bodyText =
                          typeof bodyTemplate === 'string'
                            ? bodyTemplate
                            : `${trimmed} lades till i ${targetGroup}.`;
                        toast(bodyText);
                      }}
                    >
                      <Text style={styles.saveButtonText}>{t('library.addCta')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </GlassCard>

        {displayGroups.map((group) => (
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
                    {t('library.metaCount', undefined, group.exercises.length)}
                  </Text>
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
                  const isSelected = selectedExercises.some(
                    (p) => p.name === name && p.group === group.group
                  );
                  const isLast = index === group.exercises.length - 1;
                  const latest = latestPerformanceByExercise.get(name.trim().toLowerCase());
                  const isFavorite = favoriteKeys.includes(toExerciseKey(name, group.group));

                  return (
                    <TouchableOpacity
                      key={name}
                      onPress={() => handlePressExercise(name, group.group)}
                      activeOpacity={0.8}
                      style={[
                        styles.exerciseRow,
                        !isLast && styles.exerciseRowDivider,
                        isSelected && styles.exerciseRowActive,
                      ]}
                      accessibilityLabel={t('library.selectExercise', undefined, displayName)}
                      accessibilityRole="button"
                    >
                      <View style={styles.exerciseNameWrapper}>
                        <View style={[styles.exerciseDot, isSelected && styles.exerciseDotActive]} />
                        <View style={styles.exerciseTextCol}>
                          <Text
                            style={[
                              styles.exerciseName,
                              isSelected && styles.exerciseNameActive,
                            ]}
                            accessible={false}
                          >
                            {displayName}
                          </Text>
                          <Text style={styles.exerciseMeta}>
                            {latest
                              ? t('library.latestMeta', undefined, {
                                  reps: latest.reps,
                                  weight: latest.weight,
                                  date: latest.date,
                                })
                              : t('library.latestEmpty')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.exerciseActions}>
                        <TouchableOpacity
                          style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleFavorite(name, group.group);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t('library.toggleFavoriteA11y', undefined, displayName)}
                        >
                          <Star size={14} color={isFavorite ? colors.warning : colors.textSoft} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.quickAddBtn, isSelected && styles.quickAddBtnActive]}
                          onPress={(event) => {
                            event.stopPropagation();
                            handlePressExercise(name, group.group);
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={t('library.selectExercise', undefined, displayName)}
                        >
                          <Text style={[styles.quickAddBtnText, isSelected && styles.quickAddBtnTextActive]}>
                            {isSelected ? t('library.quickAdded') : t('library.quickAdd')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </GlassCard>
        ))}
        {displayGroups.length === 0 && (
          <GlassCard style={styles.card}>
            <EmptyState
              title={t('library.emptySearchTitle')}
              subtitle={t('library.emptySearchSubtitle')}
              ctaLabel={t('library.clearSearch')}
              onPressCta={() => {
                setSearchQuery('');
                setActiveGroupFilter('all');
              }}
            />
          </GlassCard>
        )}

        {selectedExercises.length > 0 && (() => {
          const moveTarget = moveGroup;
          const hasTarget = !!moveTarget;
          return (
            <View style={styles.footerInfo}>
              <Text style={styles.footerLabel}>{t('library.footerSelected')}</Text>
              <Text style={styles.footerValue}>
                {selectedExercises.length === 1
                  ? translateName(selectedExercises[0].name)
                  : t('library.footerSelectedMany', undefined, selectedExercises.length)}
              </Text>
              {selectedExercises.length === 1 ? (
                <Text style={styles.footerHint}>
                  {translateGroup(selectedExercises[0].group)}
                </Text>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>
                {t('library.groupLabel')}
              </Text>
              <View style={styles.chipRow}>
                {groupNames.map((g) => {
                  const active = moveGroup === g;
                  return (
                    <TouchableOpacity
                      key={`move-${g}`}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setMoveGroup(g)}
                      accessibilityRole="button"
                      accessibilityLabel={t('library.selectGroup', undefined, translateGroup(g))}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {translateGroup(g)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={() => {
                    selectedExercises.forEach((sel) =>
                      removeCustomExercise(sel.name, sel.group)
                    );
                    setSelectedExercises([]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('library.removeExerciseA11y')}
                >
                  <Trash2 size={14} color="#fca5a5" />
                  <Text style={styles.actionButtonText}>{t('library.remove')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.moveButton,
                    (!hasTarget || selectedExercises.every((sel) => moveTarget === sel.group)) &&
                      styles.actionDisabled,
                  ]}
                  disabled={
                    !hasTarget || selectedExercises.every((sel) => moveTarget === sel.group)
                  }
                  onPress={() => {
                    if (!hasTarget) return;
                    const updated = new Set<string>();
                    selectedExercises.forEach((sel) => {
                      if (moveTarget === sel.group) {
                        updated.add(`${sel.name}::${sel.group}`);
                        return;
                      }
                      removeCustomExercise(sel.name, sel.group);
                      addCustomExercise({
                        name: sel.name,
                        muscleGroup: moveTarget,
                      });
                      updated.add(`${sel.name}::${moveTarget}`);
                    });
                    setSelectedExercises(
                      Array.from(updated).map((key) => {
                        const [name, group] = key.split('::');
                        return { name, group };
                      })
                    );
                    setMoveGroup('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('library.moveExerciseA11y')}
                >
                  <MoveRight size={14} color={colors.accentBlue} />
                  <Text style={styles.actionButtonText}>{t('library.move')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
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
  backRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: spacing.md,
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
    marginTop: layout.sectionGap,
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
    alignItems: 'flex-start',
    gap: 8,
  },
  exerciseTextCol: {
    flex: 1,
  },
  exerciseName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  exerciseNameActive: {
    color: '#bbf7d0',
  },
  exerciseMeta: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
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
  filterRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sortRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
    justifyContent: 'center',
  },
  filterChipActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.textMain,
  },
  sortChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  sortChipActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  sortChipText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: colors.textMain,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favoriteBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtnActive: {
    borderColor: colors.warning,
    backgroundColor: colors.primarySoft,
  },
  quickAddBtn: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  quickAddBtnActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  quickAddBtnText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  quickAddBtnTextActive: {
    color: colors.textMain,
  },
  footerInfo: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  actionButtonText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  dangerButton: {
    borderColor: '#b91c1c',
    backgroundColor: 'rgba(127,29,29,0.45)',
  },
  moveButton: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.backgroundSoft,
  },
  input: {
    minHeight: inputs.height,
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
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
    borderColor: colors.cardBorder,
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
  groupAddButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  groupAddButtonText: {
    ...typography.bodyBold,
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
  groupRemoveRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  groupRemoveChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#2f1212',
  },
  groupRemoveText: {
    ...typography.micro,
    color: '#fca5a5',
    fontWeight: '700',
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
  formBlock: {
    gap: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#111827',
    marginVertical: 10,
  },
  formHint: {
    ...typography.micro,
    color: '#fca5a5',
  },
});
