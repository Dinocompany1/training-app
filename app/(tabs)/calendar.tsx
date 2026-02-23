// app/(tabs)/calendar.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import GlassCard from '../../components/ui/GlassCard';
import BadgePill from '../../components/ui/BadgePill';
import ScreenHeader from '../../components/ui/ScreenHeader';
import StaggerReveal from '../../components/ui/StaggerReveal';
import { colors, gradients, spacing, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { loadAICoachProfile } from '../../utils/aiCoachProfile';
import { toast } from '../../utils/toast';
import { parseISODate, toISODate, todayISO } from '../../utils/date';
import { getWeekRange } from '../../utils/weekRange';
import { createId } from '../../utils/id';

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
const makeId = () => createId('cal');
type CalendarMark = {
  customStyles: {
    container: {
      backgroundColor: string;
      borderRadius: number;
      borderWidth: number;
      borderColor: string;
      padding?: number;
    };
    text: {
      color: string;
      fontWeight: '700' | '800';
    };
  };
};

const getWeekDatesFromISO = (baseISO: string) => {
  const base = parseISODate(baseISO) || new Date();
  const { start } = getWeekRange(base);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return toISODate(day);
  });
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const parsePreferredWeekdayIndexes = (scheduleRaw: string): number[] | null => {
  const schedule = normalizeText(scheduleRaw || '');
  if (!schedule) return null;

  if (
    schedule.includes('vardag') ||
    schedule.includes('weekdays') ||
    schedule.includes('weekday') ||
    schedule.includes('workday')
  ) {
    return [0, 1, 2, 3, 4];
  }

  const rules: { idx: number; keys: string[] }[] = [
    { idx: 0, keys: ['man', 'monday', 'mon'] },
    { idx: 1, keys: ['tis', 'tuesday', 'tue'] },
    { idx: 2, keys: ['ons', 'wednesday', 'wed'] },
    { idx: 3, keys: ['tor', 'thursday', 'thu'] },
    { idx: 4, keys: ['fre', 'friday', 'fri'] },
    { idx: 5, keys: ['lor', 'saturday', 'sat'] },
    { idx: 6, keys: ['son', 'sunday', 'sun'] },
  ];

  const matched = rules
    .filter((rule) => rule.keys.some((key) => schedule.includes(key)))
    .map((rule) => rule.idx);

  return matched.length > 0 ? matched : null;
};

export default function CalendarScreen() {
  const { workouts, removeWorkout, addWorkout, templates, weeklyGoal } = useWorkouts();
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DAY' | 'DONE' | 'PLANNED'>('ALL');
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[] | null>(null);
  const todayIso = todayISO();

  useEffect(() => {
    loadAICoachProfile().then((profile) => {
      setPreferredWeekdays(parsePreferredWeekdayIndexes(profile.schedule || ''));
    });
  }, []);

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
      const key = w.id || `${w.title}-${w.sourceTemplateId || ''}-${w.date}`;
      const existing = byKey.get(key);
      if (!existing || (!existing.isCompleted && w.isCompleted)) {
        byKey.set(key, w);
      }
    });
    return Array.from(byKey.values());
  }, []);

  const dedupedWorkouts = useMemo(() => dedupeWorkouts(workouts), [dedupeWorkouts, workouts]);
  const templateById = useMemo(
    () => new Map((templates || []).map((template) => [template.id, template])),
    [templates]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, CalendarMark> = {};
    const perDay = new Map<
      string,
      { hasDone: boolean; hasPlanned: boolean; doneColor: string; plannedColor: string }
    >();

    dedupedWorkouts.forEach((w) => {
      const color = w.color || '#3b82f6';
      const existing = perDay.get(w.date) || {
        hasDone: false,
        hasPlanned: false,
        doneColor: color,
        plannedColor: color,
      };
      if (w.isCompleted) {
        existing.hasDone = true;
        existing.doneColor = color;
      } else {
        existing.hasPlanned = true;
        existing.plannedColor = color;
      }
      perDay.set(w.date, existing);
    });

    perDay.forEach((state, date) => {
      if (state.hasDone && state.hasPlanned) {
        marks[date] = {
          customStyles: {
            container: {
              backgroundColor: hexToRgba(state.doneColor, 0.28),
              borderRadius: 10,
              borderWidth: 1,
              borderColor: state.plannedColor,
            },
            text: {
              color: '#f9fafb',
              fontWeight: '700',
            },
          },
        };
        return;
      }
      if (state.hasDone) {
        marks[date] = {
          customStyles: {
            container: {
              backgroundColor: state.doneColor,
              borderRadius: 10,
              borderWidth: 0,
              borderColor: 'transparent',
            },
            text: {
              color: '#f9fafb',
              fontWeight: '700',
            },
          },
        };
        return;
      }
      marks[date] = {
        customStyles: {
          container: {
            backgroundColor: hexToRgba(state.plannedColor, 0.2),
            borderRadius: 10,
            borderWidth: 1,
            borderColor: state.plannedColor,
          },
          text: {
            color: '#e5e7eb',
            fontWeight: '700',
          },
        },
      };
    });

    if (selectedDate) {
      const existing = marks[selectedDate];
      marks[selectedDate] = {
        customStyles: {
          container: {
            ...(existing?.customStyles.container || {
              backgroundColor: '#0f172a',
              borderRadius: 10,
              borderWidth: 0,
              borderColor: 'transparent',
            }),
            borderWidth: 2,
            borderColor: '#fbbf24',
            padding: 1,
          },
          text: {
            ...(existing?.customStyles.text || { color: '#e5e7eb', fontWeight: '700' }),
            fontWeight: '800',
          },
        },
      };
    }

    return marks;
  }, [dedupedWorkouts, selectedDate]);

  const listData = useMemo(() => {
    const base = [...dedupedWorkouts];
    if (statusFilter === 'DAY') {
      const filtered = selectedDate ? base.filter((w) => w.date === selectedDate) : [];
      return filtered.sort((a, b) => b.date.localeCompare(a.date));
    }
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
    // ALL -> visa allt (senaste överst)
    return base.sort((a, b) => b.date.localeCompare(a.date));
  }, [dedupedWorkouts, selectedDate, statusFilter]);

  const totalWorkouts = workouts.length;
  const latestCompletedWorkout = useMemo(
    () =>
      [...dedupedWorkouts]
        .filter((w) => w.isCompleted)
        .sort((a, b) => b.date.localeCompare(a.date))[0] || null,
    [dedupedWorkouts]
  );
  const weekDates = useMemo(
    () => getWeekDatesFromISO(selectedDate || todayIso),
    [selectedDate, todayIso]
  );
  const weekWorkouts = useMemo(
    () => dedupedWorkouts.filter((w) => weekDates.includes(w.date)),
    [dedupedWorkouts, weekDates]
  );
  const weekCompleted = useMemo(
    () => weekWorkouts.filter((w) => w.isCompleted).length,
    [weekWorkouts]
  );
  const weekPlanned = useMemo(
    () => weekWorkouts.filter((w) => !w.isCompleted).length,
    [weekWorkouts]
  );
  const weekMinutes = useMemo(
    () => weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0),
    [weekWorkouts]
  );
  const weekGoal = Math.max(0, weeklyGoal || 0);
  const weekProgress = weekGoal > 0 ? Math.min(1, weekCompleted / weekGoal) : weekCompleted > 0 ? 1 : 0;
  const weekLeft = weekGoal > 0 ? Math.max(0, weekGoal - weekCompleted) : 0;

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
    setStatusFilter('DAY');
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
          toast({
            message: t('calendar.deletedToast'),
            action: {
              label: t('common.undo'),
              onPress: () => {
                Haptics.selectionAsync();
                addWorkout(w);
                toast(t('common.restored'));
              },
            },
          });
        },
      },
    ]);
  };

  const handleQuickPlan = () => {
    if (!selectedDate) return;
    Haptics.selectionAsync();
    router.push({
      pathname: '/schedule-workout',
      params: { date: selectedDate },
    });
  };

  const handleQuickStart = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/workout/quick-workout',
      params: {
        title: t('calendar.quick.startDefaultTitle'),
        color: '#3b82f6',
      },
    });
  };

  const handleQuickCopyLatest = () => {
    if (!selectedDate) return;
    if (selectedDate < todayIso) {
      toast(t('schedule.datePast'));
      return;
    }
    if (!latestCompletedWorkout) {
      toast(t('calendar.quick.copyNoSource'));
      return;
    }

    const copiedWorkout = {
      ...latestCompletedWorkout,
      id: makeId(),
      date: selectedDate,
      isCompleted: false,
      durationMinutes: undefined,
      exercises: (latestCompletedWorkout.exercises || []).map((ex) => ({
        id: makeId(),
        name: ex.name,
        sets: Math.max(1, ex.sets || ex.performedSets?.length || 1),
        reps: ex.reps || ex.performedSets?.[0]?.reps || '8-10',
        weight: Number.isFinite(ex.weight) ? ex.weight : 0,
        muscleGroup: ex.muscleGroup,
      })),
    };

    addWorkout(copiedWorkout);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(
      t('calendar.quick.copySuccess', undefined, {
        title: latestCompletedWorkout.title,
        date: selectedDate,
      })
    );
    setStatusFilter('ALL');
  };

  const handleAutoPlanWeek = () => {
    if (templates.length === 0) {
      toast(t('calendar.week.autoPlanNoTemplates'));
      return;
    }

    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    const isPastWeek = weekEnd < todayIso;
    const isCurrentWeek = weekStart <= todayIso && todayIso <= weekEnd;

    if (isPastWeek) {
      toast(t('calendar.week.autoPlanPastWeek'));
      return;
    }

    const weekDateSet = new Set(weekDates);
    const weekOccupied = new Set(
      dedupedWorkouts.filter((w) => weekDateSet.has(w.date)).map((w) => w.date)
    );
    const horizonDates = isCurrentWeek
      ? weekDates.filter((iso) => iso >= todayIso)
      : weekDates;
    const candidateDates = preferredWeekdays
      ? weekDates.filter(
          (iso, index) =>
            preferredWeekdays.includes(index) && (!isCurrentWeek || iso >= todayIso)
        )
      : horizonDates;
    let freeDates = candidateDates.filter((iso) => !weekOccupied.has(iso));
    // Fallback: if profile schedule is too narrow, use any remaining day in horizon.
    if (freeDates.length === 0) {
      freeDates = horizonDates.filter((iso) => !weekOccupied.has(iso));
    }

    if (freeDates.length === 0) {
      toast(t('calendar.week.autoPlanNoSlots'));
      return;
    }

    const coveredByPlan = weekCompleted + weekPlanned;
    const desiredAdds =
      weekGoal > 0 ? Math.max(0, weekGoal - coveredByPlan) : freeDates.length;
    const addCount =
      weekGoal > 0
        ? Math.min(freeDates.length, Math.max(1, desiredAdds))
        : Math.min(freeDates.length, 3);

    if (weekGoal > 0 && desiredAdds === 0) {
      toast(t('calendar.week.autoPlanGoalCovered'));
      return;
    }

    const templateOffset = weekWorkouts.length % templates.length;

    for (let i = 0; i < addCount; i += 1) {
      const template = templates[(templateOffset + i) % templates.length];
      const date = freeDates[i];
      addWorkout({
        id: makeId(),
        title: template.name,
        date,
        notes: template.description || '',
        color: template.color,
        sourceTemplateId: template.id,
        isCompleted: false,
        exercises: (template.exercises || []).map((ex) => ({
          id: makeId(),
          name: ex.name,
          sets: Math.max(1, ex.sets || 1),
          reps: ex.reps || '8-10',
          weight: Number.isFinite(ex.weight) ? ex.weight : 0,
          muscleGroup: ex.muscleGroup,
        })),
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(t('calendar.week.autoPlanDone', undefined, { count: addCount }));
    setSelectedDate(freeDates[0] || selectedDate);
    setStatusFilter('ALL');
  };

  return (
    <View style={styles.gradient}>
      <LinearGradient
        colors={gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          ListEmptyComponent={null}
          ListHeaderComponent={
            <>
              <StaggerReveal delay={40}>
                <ScreenHeader
                  title={t('calendar.title')}
                  subtitle={t('calendar.subtitle')}
                  tone="amber"
                  style={styles.header}
                />
              </StaggerReveal>

              <StaggerReveal delay={80}>
                <View style={styles.row}>
                  <GlassCard style={styles.smallCard}>
                    <Text style={styles.smallLabel}>{t('calendar.totalLabel')}</Text>
                    <Text style={styles.smallValue}>{totalWorkouts}</Text>
                    <Text style={styles.smallSub}>
                      {t('calendar.subtitle')}
                    </Text>
                  </GlassCard>
                </View>
              </StaggerReveal>

              <StaggerReveal delay={120}>
                <GlassCard style={styles.weekCard} tone="amber">
                <View style={styles.weekHeaderRow}>
                  <View style={styles.weekHeaderText}>
                    <Text style={styles.weekTitle}>{t('calendar.week.title')}</Text>
                    <Text style={styles.weekSub}>
                      {t('calendar.week.range', undefined, {
                        start: weekDates[0],
                        end: weekDates[6],
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.weekActionBtn}
                    activeOpacity={0.9}
                    onPress={handleAutoPlanWeek}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.week.autoPlanA11y')}
                  >
                    <Text style={styles.weekActionText}>{t('calendar.week.autoPlan')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.weekProgressTrack}>
                  <View style={[styles.weekProgressFill, { width: `${Math.max(6, weekProgress * 100)}%` }]} />
                </View>

                <Text style={styles.weekProgressText}>
                  {weekGoal > 0
                    ? t('calendar.week.progress', undefined, { done: weekCompleted, goal: weekGoal })
                    : t('calendar.week.noGoal')}
                </Text>
                <Text style={styles.weekMeta}>
                  {t('calendar.week.meta', undefined, {
                    planned: weekPlanned,
                    minutes: weekMinutes,
                    left: weekLeft,
                  })}
                </Text>
                </GlassCard>
              </StaggerReveal>

              <StaggerReveal delay={160}>
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
              </StaggerReveal>

              <StaggerReveal delay={200}>
                <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {statusFilter === 'DAY'
                    ? selectedDate
                      ? t('calendar.listForDay', undefined, selectedDate)
                      : t('calendar.selectDay')
                    : statusFilter === 'DONE'
                    ? t('calendar.filters.done')
                    : statusFilter === 'PLANNED'
                    ? t('calendar.filters.planned')
                    : t('calendar.filters.all')}
                </Text>
                {selectedDate && (
                  <View style={styles.quickActionsRow}>
                    <TouchableOpacity
                      style={[styles.planChip, styles.quickActionBtn]}
                      onPress={handleQuickPlan}
                      activeOpacity={0.9}
                      accessibilityLabel={t('calendar.planForDayA11y')}
                      accessibilityRole="button"
                    >
                      <Text style={styles.planChipText}>{t('calendar.quick.plan')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickActionBtn, styles.quickStartBtn]}
                      onPress={handleQuickStart}
                      activeOpacity={0.9}
                      accessibilityLabel={t('calendar.quick.startA11y')}
                      accessibilityRole="button"
                    >
                      <Text style={styles.quickStartText}>{t('calendar.quick.start')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickActionBtn, styles.quickCopyBtn]}
                      onPress={handleQuickCopyLatest}
                      activeOpacity={0.9}
                      accessibilityLabel={t('calendar.quick.copyA11y')}
                      accessibilityRole="button"
                    >
                      <Text style={styles.quickCopyText}>{t('calendar.quick.copyLatest')}</Text>
                    </TouchableOpacity>
                  </View>
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

                <View style={styles.filterRow}>
                  {[
                    { key: 'ALL', label: t('calendar.filters.all') },
                    { key: 'DAY', label: t('calendar.filters.day') },
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

                {selectedDate && listData.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                      {t('calendar.emptyDay')}
                    </Text>
                  </View>
                )}
                </View>
              </StaggerReveal>
            </>
          }
          renderItem={({ item: w }) => {
            const durationLabel = w.durationMinutes
              ? `${w.durationMinutes} min`
              : t('calendar.meta.durationUnknown');
            const linkedTemplate = w.sourceTemplateId
              ? templateById.get(w.sourceTemplateId)
              : null;
            const templateName = linkedTemplate?.name || null;

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
                                backgroundColor: linkedTemplate?.color || w.color || colors.primary,
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
                         router.push({
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
    paddingTop: spacing.lg,
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
  weekCard: {
    marginBottom: spacing.sm + spacing.xs,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  weekHeaderText: {
    flex: 1,
  },
  weekTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '800',
  },
  weekSub: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
  },
  weekActionBtn: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekActionText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: '800',
  },
  weekProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  weekProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  weekProgressText: {
    ...typography.caption,
    color: colors.textMain,
    marginTop: 8,
    fontWeight: '700',
  },
  weekMeta: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
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
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 0,
  },
  planChipText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickActionBtn: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  quickStartBtn: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentGreen,
  },
  quickStartText: {
    ...typography.micro,
    color: colors.accentGreen,
    fontWeight: '800',
    textAlign: 'center',
  },
  quickCopyBtn: {
    borderRadius: 12,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  quickCopyText: {
    ...typography.micro,
    color: colors.accentBlue,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    backgroundColor: colors.backgroundSoft,
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
    color: colors.textMuted,
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
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templatePillText: {
    color: colors.textMain,
    fontSize: 11,
    fontWeight: '700',
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.backgroundSoft,
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
    backgroundColor: colors.surface,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundSoft,
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
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
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
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.cardBorder,
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
