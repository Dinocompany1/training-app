import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useWorkouts } from '../../context/WorkoutsContext';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonCard from '../../components/ui/SkeletonCard';
import { colors } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { formatDateLong, parseISODate } from '../../utils/date';
import { useTranslation } from '../../context/TranslationContext';

export default function HistoryScreen() {
  const router = useRouter();
  const { workouts, addWorkout, removeWorkout, templates } = useWorkouts();
  const { t, lang } = useTranslation();

  const handleStart = (item: typeof sorted[number]) => {
    Haptics.selectionAsync();
    router.replace({
      pathname: '/workout/quick-workout',
      params: {
        title: item.title,
        color: item.color,
        templateId: item.sourceTemplateId,
      },
    });
  };

  const handleDelete = (item: typeof sorted[number]) => {
    Alert.alert(t('history.deleteTitle'), t('history.deleteConfirm', undefined, item.title), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          removeWorkout(item.id);
          toast(t('history.deletedToast'));
          Alert.alert(t('history.deletedTitle'), t('history.deletedBody'), [
            {
              text: t('common.undo'),
              style: 'default',
              onPress: () => {
                Haptics.selectionAsync();
                addWorkout(item);
              },
            },
            { text: t('common.ok'), style: 'default' },
          ]);
        },
      },
    ]);
  };

  const sorted = useMemo(() => {
    return [...workouts].sort((a, b) => {
      const da = parseISODate(a.date)?.getTime() ?? 0;
      const db = parseISODate(b.date)?.getTime() ?? 0;
      return db - da; // nyaste först
    });
  }, [workouts]);

  const renderItem = ({ item }: { item: typeof sorted[number] }) => {
    const d = parseISODate(item.date);
    const dateNice = formatDateLong(item.date, lang);
    const templateName = item.sourceTemplateId
      ? templates.find((t) => t.id === item.sourceTemplateId)?.name
      : null;
    const durationLabel = item.durationMinutes
      ? `${item.durationMinutes} min`
      : t('history.durationUnknown');
    const statusLabel = item.isCompleted ? t('history.statusDone') : t('history.statusPlanned');
    const statusStyle = item.isCompleted
      ? styles.statusBadgeDone
      : styles.statusBadgePlanned;

    return (
      <GlassCard style={styles.card}>
        <TouchableOpacity
          style={styles.cardRow}
          activeOpacity={0.9}
          onPress={() => router.push(`/workout/${item.id}`)}
        >
          <View
            style={[
              styles.iconCircle,
              { borderColor: item.color || colors.primary },
            ]}
          >
            <Text style={styles.iconText}>{d ? d.getDate() : '?'}</Text>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.workoutTitle}>{item.title}</Text>
            <Text style={styles.workoutDate}>{dateNice}</Text>
            {item.sourceTemplateId ? (
              <View style={styles.templatePill}>
                <View style={styles.templateDot} />
                <Text style={styles.templatePillText}>
                  {templateName || t('history.routine')}
                </Text>
              </View>
            ) : null}

            {item.notes ? (
              <Text style={styles.workoutNotes} numberOfLines={1}>
                {item.notes}
              </Text>
            ) : (
              <Text style={styles.notesPlaceholder}>{t('history.notesNone')}</Text>
            )}

            <View style={styles.badgeRow}>
              <View style={[styles.badge, statusStyle]}>
                <Text
                  style={[
                    styles.badgeText,
                    item.isCompleted && styles.badgeTextDark,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {t('history.exerciseCount', undefined, item.exercises?.length ?? 0)}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{durationLabel}</Text>
              </View>
              {!!item.sourceTemplateId && (
                <TouchableOpacity
                  style={[styles.badge, styles.startBadge]}
                  onPress={() => handleStart(item)}
                  activeOpacity={0.9}
                  accessibilityLabel={t('history.startRoutineA11y')}
                  accessibilityRole="button"
                >
                  <Text style={styles.startBadgeText}>{t('history.startRoutine')}</Text>
                </TouchableOpacity>
              )}
              {!item.isCompleted && (
                <TouchableOpacity
                  style={[styles.badge, styles.startBadge]}
                  onPress={() => handleStart(item)}
                  activeOpacity={0.9}
                  accessibilityLabel={t('history.startNowA11y')}
                  accessibilityRole="button"
                >
                  <Text style={styles.startBadgeText}>{t('history.startNow')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.badge, styles.startBadge]}
                onPress={() => handleDelete(item)}
                activeOpacity={0.9}
                accessibilityLabel={t('history.deleteA11y')}
                accessibilityRole="button"
              >
                <Text style={styles.startBadgeText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        renderItem={renderItem}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('history.title')}</Text>
              <Text style={styles.subtitle}>
                {t('history.subtitle')}
              </Text>
            </View>
            {sorted.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{sorted.length}</Text>
                <Text style={styles.countLabel}>{t('history.countLabel')}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          sorted.length === 0 && workouts.length > 0 ? (
            <>
              <SkeletonCard height={90} />
              <SkeletonCard height={90} />
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('history.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('history.emptyText')}
              </Text>
            </View>
          )
        )}
        ListFooterComponent={<View style={{ height: 40 }} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#050816',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    alignItems: 'flex-end',
  },
  countText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#22c55e',
  },
  countLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  card: {
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  iconText: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 16,
  },
  cardContent: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
  },
  workoutDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  workoutNotes: {
    fontSize: 12,
    color: '#e5e7eb',
  },
  templateBadge: {
    fontSize: 11,
    color: '#c4b5fd',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  notesPlaceholder: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  badgeTextDark: {
    color: '#0b1220',
    fontWeight: '800',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  statusBadgeDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusBadgePlanned: {
    backgroundColor: '#0b1220',
    borderColor: colors.primary,
  },
  startBadge: {
    borderColor: colors.primary,
    backgroundColor: '#0b1220',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  startBadgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e1b4b',
    borderColor: '#312e81',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  templateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  templatePillText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
});
