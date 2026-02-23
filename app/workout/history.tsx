import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkouts } from '../../context/WorkoutsContext';
import GlassCard from '../../components/ui/GlassCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SkeletonCard from '../../components/ui/SkeletonCard';
import BackPill from '../../components/ui/BackPill';
import { colors, gradients, radii, typography } from '../../constants/theme';
import { toast } from '../../utils/toast';
import { formatDateLong, parseISODate } from '../../utils/date';
import { useTranslation } from '../../context/TranslationContext';

export default function HistoryScreen() {
  const router = useRouter();
  const { workouts, addWorkout, removeWorkout, templates } = useWorkouts();
  const { t, lang } = useTranslation();

  const handleStart = (item: typeof sorted[number]) => {
    Haptics.selectionAsync();
    router.push({
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
          toast({
            message: t('history.deletedToast'),
            action: {
              label: t('common.undo'),
              onPress: () => {
                Haptics.selectionAsync();
                addWorkout(item);
                toast(t('common.restored'));
              },
            },
          });
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
            <Text style={styles.workoutDate}>{`${dateNice} · ${durationLabel}`}</Text>
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
              {!!item.sourceTemplateId && (
                <TouchableOpacity
                  style={[styles.badge, styles.actionSecondary]}
                  onPress={() => handleStart(item)}
                  activeOpacity={0.9}
                  accessibilityLabel={t('history.startRoutineA11y')}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionSecondaryText}>{t('history.startRoutine')}</Text>
                </TouchableOpacity>
              )}
              {!item.isCompleted && (
                <TouchableOpacity
                  style={[styles.badge, styles.actionPrimary]}
                  onPress={() => handleStart(item)}
                  activeOpacity={0.9}
                  accessibilityLabel={t('history.startNowA11y')}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionPrimaryText}>{t('history.startNow')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.badge, styles.actionDanger]}
                onPress={() => handleDelete(item)}
                activeOpacity={0.9}
                accessibilityLabel={t('history.deleteA11y')}
                accessibilityRole="button"
              >
                <Text style={styles.actionDangerText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        renderItem={renderItem}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <BackPill onPress={() => router.back()} />
            </View>
            <View style={styles.headerMain}>
              <View>
                <ScreenHeader
                  title={t('history.title')}
                  subtitle={t('history.subtitle')}
                  compact
                  tone="blue"
                  style={styles.headerTitle}
                />
              </View>
              {sorted.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{sorted.length}</Text>
                  <Text style={styles.countLabel}>{t('history.countLabel')}</Text>
                </View>
              )}
            </View>
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
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    paddingBottom: 6,
  },
  headerMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    marginBottom: 0,
  },
  title: {
    ...typography.display,
    color: '#fff',
  },
  subtitle: {
    ...typography.caption,
    color: '#9ca3af',
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 84,
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
    ...typography.bodyBold,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  emptyText: {
    ...typography.caption,
    color: '#9ca3af',
  },
  card: {
    marginBottom: 10,
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
    borderColor: '#334155',
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
    ...typography.bodyBold,
    color: '#f9fafb',
  },
  workoutDate: {
    ...typography.caption,
    color: '#9ca3af',
    marginBottom: 2,
  },
  workoutNotes: {
    ...typography.caption,
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
    ...typography.caption,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
  },
  badgeText: {
    fontSize: 11,
    color: colors.textSoft,
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
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  statusBadgePlanned: {
    backgroundColor: '#0b1220',
    borderColor: '#334155',
  },
  actionPrimary: {
    borderColor: '#60a5fa',
    backgroundColor: '#2563eb',
  },
  actionPrimaryText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 11,
  },
  actionSecondary: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  actionSecondaryText: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 11,
  },
  actionDanger: {
    borderColor: '#f87171',
    backgroundColor: '#2b1116',
  },
  actionDangerText: {
    color: '#fecaca',
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
