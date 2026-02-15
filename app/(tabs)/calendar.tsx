// app/(tabs)/calendar.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import GlassCard from '../../components/ui/GlassCard';
import BadgePill from '../../components/ui/BadgePill';
import { colors, gradients, spacing, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { toast } from '../../utils/toast';
import { todayISO } from '../../utils/date';

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type CalendarDay = { dateString: string };

export default function CalendarScreen() {
  const { workouts, removeWorkout, addWorkout, templates } = useWorkouts();
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DONE' | 'PLANNED'>('ALL');
  const todayIso = todayISO();

  const nearestWorkoutDate = useMemo(() => {
    if (workouts.length === 0) return null;
    const upcoming = workouts
      .map((w) => w.date)
      .filter((d) => d >= todayIso)
      .sort();
    if (upcoming.length > 0) return upcoming[0];
    // annars äldsta
    return workouts.map((w) => w.date).sort()[0] || null;
  }, [workouts, todayIso]);

  useEffect(() => {
    if (!selectedDate && nearestWorkoutDate) {
      setSelectedDate(nearestWorkoutDate);
    } else if (!selectedDate && workouts.length === 0) {
      setSelectedDate(todayIso);
    }
  }, [nearestWorkoutDate, selectedDate, todayIso, workouts.length]);

  const dedupeWorkouts = useCallback((items: typeof workouts) => {
    const byKey = new Map<string, (typeof workouts)[number]>();
    items.forEach((w) => {
      const key = `${w.title}-${w.sourceTemplateId || ''}-${w.date}`;
      const existing = byKey.get(key);
      if (!existing || (!existing.isCompleted && w.isCompleted)) {
        byKey.set(key, w);
      }
    });
    return Array.from(byKey.values());
  }, []);

  const dedupedWorkouts = useMemo(() => dedupeWorkouts(workouts), [dedupeWorkouts, workouts]);

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      {
        customStyles: {
          container: object;
          text: object;
        };
      }
    > = {};

    dedupedWorkouts.forEach((w) => {
      const color = w.color || '#3b82f6';
      const textColor = '#f9fafb';
      const isPlanned = !w.isCompleted;
      const plannedBackground = hexToRgba(color, 0.2);

      // om flera pass samma dag – vi låter sista “vinna”
      marks[w.date] = {
        customStyles: {
          container: {
            backgroundColor: isPlanned ? plannedBackground : color,
            borderRadius: 10,
            borderWidth: isPlanned ? 1 : 0,
            borderColor: isPlanned ? color : 'transparent',
          },
          text: {
            color: isPlanned ? '#e5e7eb' : textColor,
            fontWeight: '700',
          },
        },
      };
    });

    if (selectedDate) {
      // lägg en liten extra “ring”-känsla runt vald dag
      const existing = marks[selectedDate];
      marks[selectedDate] = {
        customStyles: {
          container: {
            borderWidth: 2,
            borderColor: '#fbbf24',
            borderRadius: 10,
            padding: 1,
            backgroundColor: existing
              ? (existing.customStyles.container as any).backgroundColor
              : '#0f172a',
          },
          text: {
            color: existing
              ? (existing.customStyles.text as any).color
              : '#e5e7eb',
            fontWeight: '800',
          },
        },
      };
    }

    return marks;
  }, [dedupedWorkouts, selectedDate]);

  const listData = useMemo(() => {
    const base = [...dedupedWorkouts];
    if (statusFilter === 'DONE') {
      return base
        .filter((w) => w.isCompleted)
        .sort((a, b) => b.date.localeCompare(a.date)); // senaste överst
    }
    if (statusFilter === 'PLANNED') {
      // kommande först, sedan äldsta nedan
      const upcoming = base
        .filter((w) => !w.isCompleted)
        .sort((a, b) => a.date.localeCompare(b.date));
      return upcoming;
    }
    // ALL -> visa valt datum om det finns, annars allt (senaste överst)
    const filtered = selectedDate
      ? base.filter((w) => w.date === selectedDate)
      : base;
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [dedupedWorkouts, selectedDate, statusFilter]);

  const totalWorkouts = workouts.length;

  const daySummary = useMemo(() => {
    if (!selectedDate) return null;
    const list = dedupedWorkouts.filter((w) => w.date === selectedDate);
    const totalDuration = list.reduce(
      (sum, w) => sum + (w.durationMinutes || 0),
      0
    );
    const totalExercises = list.reduce(
      (sum, w) => sum + (w.exercises?.length || 0),
      0
    );
    return {
      total: list.length,
      duration: totalDuration,
      exercises: totalExercises,
    };
  }, [dedupedWorkouts, selectedDate]);

  const handleDayPress = (day: CalendarDay) => {
    setSelectedDate(day.dateString);
  };

  const handleDelete = (w: (typeof workouts)[number]) => {
    Alert.alert(t('calendar.deleteTitle'), t('calendar.deleteConfirm', undefined, w.title), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          removeWorkout(w.id);
          toast(t('calendar.deletedToast'));
          Alert.alert(t('calendar.deletedTitle'), t('calendar.deletedBody'), [
            {
              text: t('common.undo'),
              style: 'default',
              onPress: () => {
                Haptics.selectionAsync();
                addWorkout(w);
              },
            },
            { text: t('common.ok'), style: 'default' },
          ]);
        },
      },
    ]);
  };

  return (
    <View style={styles.gradient}>
      <LinearGradient
        colors={gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          ListEmptyComponent={null}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{t('calendar.title')}</Text>
                <Text style={styles.subtitle}>{t('calendar.subtitle')}</Text>
              </View>

              <View style={styles.row}>
                <GlassCard style={styles.smallCard}>
                  <Text style={styles.smallLabel}>{t('calendar.totalLabel')}</Text>
                  <Text style={styles.smallValue}>{totalWorkouts}</Text>
                  <Text style={styles.smallSub}>
                    {t('calendar.subtitle')}
                  </Text>
                </GlassCard>
              </View>

              <GlassCard style={styles.calendarCard}>
                <Calendar
                  theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'transparent',
                    monthTextColor: colors.textMain,
                    dayTextColor: colors.textMain,
                    textDisabledColor: '#4b5563',
                    todayTextColor: '#f97316',
                    arrowColor: colors.textMain,
                  }}
                  markingType="custom"
                  markedDates={markedDates}
                  onDayPress={handleDayPress}
                  firstDay={1}
                  disableAllTouchEventsForDisabledDays={true}
                  enableSwipeMonths={true}
                />
              </GlassCard>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {statusFilter === 'DONE'
                    ? t('calendar.filters.done')
                    : statusFilter === 'PLANNED'
                    ? t('calendar.filters.planned')
                    : selectedDate
                    ? t('calendar.listForDay', undefined, selectedDate)
                    : t('calendar.selectDay')}
                </Text>
                {selectedDate && (
                  <TouchableOpacity
                    style={styles.planChip}
                    onPress={() =>
                      router.push({
                        pathname: '/schedule-workout',
                        params: { date: selectedDate },
                      })
                    }
                    activeOpacity={0.9}
                    accessibilityLabel={t('calendar.planForDayA11y')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.planChipText}>{t('calendar.planForDay')}</Text>
                  </TouchableOpacity>
                )}

                {daySummary && (
                  <View style={styles.daySummaryRow}>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryLabel}>{t('calendar.summaryPass')}</Text>
                      <Text style={styles.summaryValue}>{daySummary.total}</Text>
                    </View>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryLabel}>{t('calendar.summaryTime')}</Text>
                      <Text style={styles.summaryValue}>
                        {daySummary.duration > 0
                          ? `${daySummary.duration} min`
                          : t('calendar.meta.durationShortUnknown')}
                      </Text>
                    </View>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryLabel}>{t('calendar.summaryExercises')}</Text>
                      <Text style={styles.summaryValue}>
                        {daySummary.exercises}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedDate && (
                  <View style={styles.filterRow}>
                    {[
                      { key: 'ALL', label: t('calendar.filters.all') },
                      { key: 'DONE', label: t('calendar.filters.done') },
                      { key: 'PLANNED', label: t('calendar.filters.planned') },
                    ].map((f) => {
                      const active = statusFilter === f.key;
                      return (
                        <BadgePill
                          key={f.key}
                          label={f.label}
                          tone={active ? 'primary' : 'neutral'}
                          style={styles.filterChip}
                          onPress={() =>
                            setStatusFilter(f.key as typeof statusFilter)
                          }
                        />
                      );
                    })}
                  </View>
                )}

                {selectedDate && listData.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                      {t('calendar.emptyDay')}
                    </Text>
                  </View>
                )}
              </View>
            </>
          }
          renderItem={({ item: w }) => {
            const durationLabel = w.durationMinutes
              ? `${w.durationMinutes} min`
              : t('calendar.meta.durationUnknown');
            const templateName = w.sourceTemplateId
              ? templates.find((t) => t.id === w.sourceTemplateId)?.name
              : null;

            return (
              <GlassCard key={w.id} style={[styles.workoutItem, styles.glowCard]}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineBar} />
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: w.color || '#3b82f6' },
                  ]}
                />
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.workoutTitle}>{w.title}</Text>
                    <View style={styles.headerPills}>
                      <View
                        style={[
                          styles.statusPill,
                          w.isCompleted
                            ? styles.statusPillDone
                            : styles.statusPillPlanned,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            w.isCompleted
                              ? styles.statusTextDone
                              : styles.statusTextPlanned,
                          ]}
                        >
                          {w.isCompleted
                            ? t('calendar.status.done')
                            : t('calendar.status.planned')}
                        </Text>
                      </View>
                      <View style={styles.datePill}>
                        <Text style={styles.dateText}>
                          {w.date}
                        </Text>
                      </View>
                      {templateName && (
                        <View style={styles.templatePill}>
                          <View
                            style={[
                              styles.templateDot,
                              {
                                backgroundColor:
                                  templates.find((t) => t.id === w.sourceTemplateId)?.color ||
                                  w.color ||
                                  colors.primary,
                              },
                            ]}
                          />
                          <Text style={styles.templatePillText}>
                            {templateName}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {w.notes ? (
                    <Text style={styles.workoutNotes}>{w.notes}</Text>
                  ) : (
                    <Text style={styles.workoutNotesMuted}>
                      {t('calendar.meta.notesNone')}
                    </Text>
                  )}
                  <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{durationLabel}</Text>
                    </View>
                  </View>
                  {w.exercises && w.exercises.length > 0 ? (
                    <View style={styles.exerciseChipRow}>
                      {w.exercises.slice(0, 3).map((ex) => (
                        <View key={ex.id} style={styles.exerciseChip}>
                          <Text style={styles.exerciseChipText}>
                            {(ex.name || t('calendar.meta.unknownExercise'))} · {ex.sets} set
                          </Text>
                        </View>
                      ))}
                      {w.exercises.length > 3 ? (
                        <View style={styles.exerciseChip}>
                          <Text style={styles.exerciseChipText}>
                            {t('calendar.moreExercises', undefined, w.exercises.length - 3)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {!w.isCompleted && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.metaPill, styles.startNowButton]}
                        onPress={() => {
                          Haptics.selectionAsync();
                         router.replace({
                            pathname: '/workout/quick-workout',
                            params: {
                              title: w.title,
                              color: w.color,
                              templateId: w.sourceTemplateId,
                              plannedId: w.id,
                            },
                          });
                        }}
                        activeOpacity={0.9}
                        accessibilityLabel={t('calendar.startNowA11y')}
                        accessibilityRole="button"
                      >
                        <Text style={styles.startNowText}>{t('calendar.startNow')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.metaPill, styles.editButton]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          router.push({
                            pathname: '/schedule-workout',
                            params: { id: w.id },
                          });
                        }}
                        activeOpacity={0.9}
                        accessibilityLabel={t('calendar.editA11y', undefined, w.title)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.editText}>{t('calendar.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.metaPill, styles.deleteButton]}
                        onPress={() => handleDelete(w)}
                        activeOpacity={0.9}
                        accessibilityLabel={t('calendar.deleteA11y')}
                        accessibilityRole="button"
                      >
                        <Text style={styles.deleteText}>{t('calendar.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {w.isCompleted && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.metaPill, styles.viewButton]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          router.push({
                            pathname: '/workout/[id]',
                            params: { id: w.id },
                          });
                        }}
                        accessibilityLabel={t('calendar.viewWorkoutA11y')}
                        accessibilityRole="button"
                        activeOpacity={0.9}
                      >
                        <Text style={styles.viewText}>{t('calendar.viewWorkout')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
              </GlassCard>
            );
          }}
          ListFooterComponent={<View style={{ height: 40 }} />}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.sm + spacing.xs,
  },
  title: {
    ...typography.display,
    fontSize: 22,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: spacing.xs,
  },
  row: {
    marginBottom: spacing.sm + spacing.xs,
    width: '100%',
  },
  smallCard: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  smallLabel: {
    ...typography.micro,
    color: colors.textMuted,
    marginBottom: 4,
  },
  smallValue: {
    ...typography.title,
    fontSize: 18,
    color: colors.textMain,
  },
  smallSub: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
  },
  calendarCard: {
    marginBottom: spacing.sm + spacing.xs,
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 8,
  },
  planChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 8,
  },
  planChipText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 14,
    backgroundColor: '#020617',
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#0b1220',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 14,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
  emptyActions: {
    marginTop: 12,
  },
  list: {
    gap: 8,
  },
  workoutItem: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: spacing.md,
  },
  glowCard: {},
  workoutTitle: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '600',
  },
  workoutNotes: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 2,
  },
  workoutNotesMuted: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  metaText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  exerciseChip: {
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exerciseChipText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  statusPill: {
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillDone: {
    backgroundColor: '#052e1d',
    borderColor: colors.accentGreen,
  },
  statusPillPlanned: {
    backgroundColor: '#20103e',
    borderColor: colors.primary,
  },
  statusText: {
    color: colors.textMain,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusTextPlanned: {
    color: '#d8b4fe',
  },
  statusTextDone: {
    color: '#86efac',
  },
  headerPills: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  templatePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#312e81',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templatePillText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  dateText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: '700',
  },
  templateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
    flexWrap: 'wrap',
    paddingTop: 2,
  },
  startNowButton: {
    borderColor: colors.accentGreen,
    backgroundColor: '#0f172a',
    marginRight: 0,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startNowText: {
    color: colors.accentGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  viewButton: {
    borderColor: colors.primary,
    backgroundColor: '#0b1220',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: '#ef4444',
    backgroundColor: '#0f172a',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    borderColor: colors.primary,
    backgroundColor: '#0b1024',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  filterChipActive: {
    borderColor: colors.accentGreen,
    backgroundColor: '#14532d',
  },
  filterText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#bbf7d0',
  },
  planButton: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
    paddingVertical: 10,
    alignItems: 'center',
  },
  planButtonText: {
    color: '#0b1220',
    fontWeight: '800',
    fontSize: 13,
  },
  daySummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  summaryPill: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#111827',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  summaryValue: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineBar: {
    width: 2,
    backgroundColor: '#1f2937',
    borderRadius: 999,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
