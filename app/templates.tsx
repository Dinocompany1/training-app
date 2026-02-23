// app/templates.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Play, Search, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/ui/GlassCard';
import AppButton from '../components/ui/AppButton';
import ScreenHeader from '../components/ui/ScreenHeader';
import { colors, gradients, layout, radii, spacing, typography } from '../constants/theme';
import { Template, useWorkouts } from '../context/WorkoutsContext';
import { toast } from '../utils/toast';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';

export default function TemplatesScreen() {
  const { templates, removeTemplate, addTemplate } = useWorkouts();
  const router = useRouter();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMuscle, setActiveMuscle] = useState('__all__');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'exercises'>('recent');
  const totalExercises = templates.reduce((sum, tpl) => sum + tpl.exercises.length, 0);
  const muscleFilters = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((tpl) =>
      tpl.exercises.forEach((ex) => set.add((ex.muscleGroup || 'Övrigt').trim() || 'Övrigt'))
    );
    return [
      { key: '__all__', label: t('templates.filterAll') },
      ...Array.from(set)
        .sort()
        .map((muscle) => ({ key: muscle, label: muscle })),
    ];
  }, [templates, t]);
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((tpl) => {
      const matchText =
        query.length === 0 ||
        tpl.name.toLowerCase().includes(query) ||
        (tpl.description || '').toLowerCase().includes(query) ||
        tpl.exercises.some((ex) => ex.name.toLowerCase().includes(query));
      const matchMuscle =
        activeMuscle === '__all__' ||
        tpl.exercises.some(
          (ex) => ((ex.muscleGroup || 'Övrigt').trim() || 'Övrigt') === activeMuscle
        );
      return matchText && matchMuscle;
    });
  }, [activeMuscle, searchQuery, templates]);
  const sortedTemplates = useMemo(() => {
    const list = [...filteredTemplates];
    const sourceOrder = new Map<string, number>(
      templates.map((template, index) => [template.id, index])
    );
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
      return list;
    }
    if (sortBy === 'exercises') {
      list.sort((a, b) => b.exercises.length - a.exercises.length);
      return list;
    }
    list.sort((a, b) => (sourceOrder.get(b.id) ?? 0) - (sourceOrder.get(a.id) ?? 0));
    return list;
  }, [filteredTemplates, sortBy, templates]);

  const handleDelete = (template: Template) => {
    Alert.alert(
      t('templates.deleteTitle'),
      t('templates.deleteConfirm', undefined, template.name),
      [
        { text: t('templates.cancel'), style: 'cancel' },
        {
          text: t('templates.delete'),
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            removeTemplate(template.id);
            toast({
              message: t('templates.deletedToast'),
              action: {
                label: t('templates.undo'),
                onPress: () => {
                  Haptics.selectionAsync();
                  addTemplate(template);
                  toast(t('common.restored'));
                },
              },
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={styles.full}>
        <View style={styles.spotlight} />
        <FlatList
          data={sortedTemplates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          ListHeaderComponent={
            <View style={styles.header}>
              <BackPill onPress={() => router.back()} />
              <ScreenHeader title={t('templates.title')} subtitle={t('templates.subtitle')} tone="blue" />
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('templates.summaryRoutines')}</Text>
                  <Text style={styles.summaryValue}>{templates.length}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('templates.summaryExercises')}</Text>
                  <Text style={styles.summaryValue}>{totalExercises}</Text>
                </View>
              </View>
              <View style={styles.searchWrap}>
                <Search size={15} color={colors.textSoft} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('templates.searchPlaceholder')}
                  placeholderTextColor={colors.textSoft}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.filterRow}>
                {muscleFilters.map((muscle) => {
                  const active = muscle.key === activeMuscle;
                  return (
                    <TouchableOpacity
                      key={muscle.key}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setActiveMuscle(muscle.key);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {muscle.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'recent' && styles.sortChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy('recent');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sortChipText, sortBy === 'recent' && styles.sortChipTextActive]}>
                    {t('templates.sortRecent')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'name' && styles.sortChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy('name');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sortChipText, sortBy === 'name' && styles.sortChipTextActive]}>
                    {t('templates.sortName')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, sortBy === 'exercises' && styles.sortChipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy('exercises');
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      sortBy === 'exercises' && styles.sortChipTextActive,
                    ]}
                  >
                    {t('templates.sortExercises')}
                  </Text>
                </TouchableOpacity>
              </View>
              <AppButton
                title={t('templates.createCta')}
                variant="primary"
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/routine-builder');
                  toast(t('templates.createToast'));
                }}
                style={{ marginTop: 8 }}
              />
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>
                    {t('templates.metaExercises', undefined, item.exercises.length)}
                    {item.description ? ` · ${item.description}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                  accessibilityLabel={t('templates.removeA11y', undefined, item.name)}
                  accessibilityRole="button"
                >
                  <Trash2 size={16} color="#fca5a5" />
                </TouchableOpacity>
              </View>
              <View style={styles.exerciseRow}>
                {item.exercises.slice(0, 3).map((ex) => (
                  <Text key={ex.name} style={styles.exerciseTag}>
                    {ex.name}
                  </Text>
                ))}
                {item.exercises.length > 3 && (
                  <Text style={styles.exerciseTag}>
                    {t('templates.moreCount', undefined, item.exercises.length - 3)}
                  </Text>
                )}
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionChip, styles.primaryChip]}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/workout/quick-workout',
                      params: {
                        title: item.name,
                        color: item.color,
                        templateId: item.id,
                      },
                    });
                  }}
                >
                  <Play size={15} color={colors.textMain} />
                  <Text style={styles.primaryText}>{t('templates.start')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionChip, styles.secondaryChip]}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/routine-builder');
                  }}
                >
                  <Text style={styles.secondaryText}>{t('templates.newRoutine')}</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {templates.length === 0 ? t('templates.title') : t('templates.searchNoResultsTitle')}
            </Text>
            <Text style={styles.emptyText}>
              {templates.length === 0
                ? t('templates.subtitle')
                : t('templates.searchNoResultsSubtitle')}
            </Text>
          </GlassCard>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
        showsVerticalScrollIndicator={false}
      />
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
  spotlight: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 300,
    backgroundColor: '#a855f733',
    opacity: 0.35,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 24,
  },
  header: {
    marginBottom: layout.sectionGap,
  },
  summaryCard: {
    marginTop: 8,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#2a3a50',
    backgroundColor: 'rgba(8,14,26,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#2a3a50',
    backgroundColor: '#0a1322',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  summaryLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  summaryValue: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 2,
  },
  searchWrap: {
    marginTop: 10,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#324762',
    backgroundColor: '#0a1422',
    minHeight: 42,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textMain,
    ...typography.body,
  },
  filterRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#324762',
    backgroundColor: '#0a1422',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.textMain,
  },
  sortRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sortChipActive: {
    borderColor: '#4ade80',
    backgroundColor: '#14532d',
  },
  sortChipText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#bbf7d0',
  },
  title: {
    ...typography.display,
    fontSize: 22,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
  },
  card: {
    marginBottom: layout.sectionGap,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 15,
    height: 15,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#d5e2f2',
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
    lineHeight: 18,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08111f',
    borderWidth: 1,
    borderColor: '#2c3f58',
  },
  exerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  exerciseTag: {
    backgroundColor: '#0a1422',
    color: colors.textSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#324762',
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.button,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
    borderWidth: 1,
  },
  primaryChip: {
    backgroundColor: '#0a1422',
    borderColor: '#334a67',
    flex: 1,
    justifyContent: 'center',
  },
  secondaryChip: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  primaryText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  secondaryText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  emptyCard: {
    marginTop: 12,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 4,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
});
