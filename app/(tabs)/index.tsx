// app/(tabs)/index.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { CalendarClock, Flame, ListChecks, Play, ArrowUpRight } from 'lucide-react-native';
import React, { useMemo, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import GlowProgressBar from '../../components/ui/GlowProgressBar';
import { colors, gradients, spacing, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { getWeekRange, isDateInRange } from '../../utils/weekRange';
import { loadOngoingQuickWorkout } from '../../utils/ongoingQuickWorkout';
import { compareISODate, parseISODate, todayISO } from '../../utils/date';

export default function HomeScreen() {
  const router = useRouter();
  const { workouts, weeklyGoal, templates } = useWorkouts();
  const { t } = useTranslation();
  const [ongoingSnapshot, setOngoingSnapshot] = React.useState<any | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayStr = todayISO(); // YYYY-MM-DD
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

  const workoutsToday = useMemo(() => {
    const todays = dedupeWorkouts(workouts.filter((w) => w.date === todayStr));
    return todays.sort((a, b) =>
      a.isCompleted === b.isCompleted ? 0 : a.isCompleted ? -1 : 1
    );
  }, [dedupeWorkouts, workouts, todayStr]);

  const startPlannedWorkout = useCallback(
    (w: (typeof workouts)[number]) => {
      router.push({
        pathname: '/workout/quick-workout',
        params: {
          title: w.title,
          color: w.color,
          templateId: w.sourceTemplateId,
          plannedId: w.id,
        },
      });
    },
    [router]
  );
  const latestWorkout = useMemo(() => {
    if (workouts.length === 0) return null;
    // Visa endast senaste avslutade passet
    const completed = workouts.filter((w) => w.isCompleted);
    if (completed.length === 0) return null;
    return completed.sort(
      (a, b) => compareISODate(b.date, a.date)
    )[0];
  }, [workouts]);
  const latestTemplateInfo = useMemo(() => {
    if (!latestWorkout?.sourceTemplateId) return null;
    const t = templates.find((tpl) => tpl.id === latestWorkout.sourceTemplateId);
    return t ? { name: t.name, color: t.color } : null;
  }, [latestWorkout, templates]);
  const weekRange = useMemo(() => getWeekRange(today), [today]);

  const workoutsThisWeek = useMemo(() => {
    const inRange = workouts.filter(
      (w) => w.isCompleted && isDateInRange(w.date, weekRange.start, weekRange.end)
    );
    return dedupeWorkouts(inRange);
  }, [dedupeWorkouts, workouts, weekRange]);

  const refreshOngoing = useCallback(() => {
    loadOngoingQuickWorkout().then((snap) => {
      if (snap && snap.exercises && snap.exercises.length > 0) {
        setOngoingSnapshot(snap);
      } else {
        setOngoingSnapshot(null);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshOngoing();
    }, [refreshOngoing])
  );

  // Enkel streak-beräkning
  const streak = useMemo(() => {
    if (workouts.length === 0) return 0;

    const uniqueDates = Array.from(
      new Set(workouts.map((w) => w.date))
    ).sort((a, b) => compareISODate(b, a));

    let count = 0;
    const parsedToday = parseISODate(todayStr) ?? today;
    const todayOnly = new Date(parsedToday.getFullYear(), parsedToday.getMonth(), parsedToday.getDate());

    const latest = parseISODate(uniqueDates[0]);
    if (!latest) return 0;
    const latestOnly = new Date(
      latest.getFullYear(),
      latest.getMonth(),
      latest.getDate()
    );
    const diffLatest = Math.floor(
      (todayOnly.getTime() - latestOnly.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (diffLatest > 1) return 0;

    for (let i = 0; i < uniqueDates.length; i++) {
      const d = parseISODate(uniqueDates[i]);
      if (!d) continue;
      const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff = Math.floor(
        (todayOnly.getTime() - dOnly.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (diff === count || diff === count + 1) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }, [workouts, today, todayStr]);

  const hasWorkoutToday = workoutsToday.length > 0;
  const weeklyProgress = weeklyGoal > 0 ? Math.min(1, workoutsThisWeek.length / weeklyGoal) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.full}>
        <LinearGradient
          colors={gradients.appBackground}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
        >
        {ongoingSnapshot && (
          <GlassCard style={styles.resumeCard} elevated={false}>
            <View style={styles.resumeHeader}>
              <View style={styles.resumeIconWrap}>
                <Play size={16} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resumeTitle}>{t('common.resumeTitle')}</Text>
                <Text style={styles.resumeSubtitle} numberOfLines={1}>
                  {ongoingSnapshot.title || t('quick.ongoing')}
                </Text>
                {ongoingSnapshot.exercises ? (
                  <Text style={styles.resumeMeta}>
                    {t('common.resumeMeta', undefined, ongoingSnapshot.exercises.length)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.resumeCTA,
                  {
                    borderColor: '#f97316',
                    backgroundColor: '#23150c',
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: '/workout/quick-workout',
                    params: {
                      resume: '1',
                      resumeSnapshot: encodeURIComponent(JSON.stringify(ongoingSnapshot)),
                    },
                  });
                }}
                accessibilityLabel={t('common.resumeA11y')}
                accessibilityRole="button"
              >
                <Text style={styles.resumeCTAText}>{t('common.resumeButton')}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* dekorativa glows borttagna för renare layout */}
        {/* Header */}
        <GlassCard style={styles.heroCard} elevated={false}>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('home.heroTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('home.heroSubtitle')}
              </Text>
              <View style={styles.heroBadges}>
                <View style={styles.heroBadge}>
                  <Flame size={14} color="#f97316" />
                  <Text style={styles.heroBadgeText}>
                    {t('home.heroStreak', undefined, { days: streak })}
                  </Text>
                </View>
                <View style={styles.heroBadge}>
                  <CalendarClock size={14} color={colors.primary} />
                  <Text style={styles.heroBadgeText}>
                    {t('home.heroGoal', undefined, {
                      done: workoutsThisWeek.length,
                      goal: weeklyGoal,
                    }) || `${workoutsThisWeek.length}/${weeklyGoal} denna vecka`}
                  </Text>
                </View>
              </View>
              </View>
              <TouchableOpacity
                style={styles.heroCTA}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/workout/quick-workout');
                }}
                activeOpacity={0.9}
              >
                <Play size={16} color="#0b1024" />
                <Text style={styles.heroCTAText}>{t('home.start')}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

        {/* Streak / veckomål */}
        <GlassCard style={styles.streakCard} elevated={false}>
          <View style={styles.streakRow}>
            <View style={styles.streakBadge}>
              <Flame size={16} color="#f97316" />
              <Text style={styles.streakBadgeText}>{t('home.streakDays', undefined, streak)}</Text>
            </View>
            <View>
              <Text style={styles.streakLabel}>{t('home.streakLabel')}</Text>
              <Text style={styles.streakValue}>
                {t('home.streakProgress', undefined, {
                  done: workoutsThisWeek.length,
                  goal: weeklyGoal || 0,
                })}
              </Text>
            </View>
          </View>
          <GlowProgressBar value={weeklyProgress} />
          <Text style={styles.streakHint}>
            Håll streaken vid liv och sikta på ditt mål den här veckan.
          </Text>
        </GlassCard>

        {/* DAGENS PASS */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View style={styles.iconCircle}>
                  <CalendarClock size={18} color={colors.accentPurple} />
                </View>
                <View>
                <Text style={styles.cardTitle}>{t('home.todayTitle')}</Text>
                <Text style={styles.cardText}>
                  {hasWorkoutToday
                    ? t('home.todayHas')
                    : t('home.todayEmpty')}
                </Text>
              </View>
            </View>
          </View>

          {hasWorkoutToday ? (
            <View style={styles.todayBox}>
              <Text style={styles.todayLabel}>{t('home.plannedToday')}</Text>
              {workoutsToday.map((w) => (
                <View key={w.id} style={styles.todayItem}>
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: w.color || colors.accentBlue },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.todayTitle}>{w.title}</Text>
                    {w.notes ? (
                      <Text style={styles.todayNote} numberOfLines={1}>
                        {w.notes}
                      </Text>
                    ) : null}
                  </View>
                  {!w.isCompleted && (
                    <TouchableOpacity
                      style={styles.smallStartPill}
                      onPress={() => {
                        Haptics.selectionAsync();
                        startPlannedWorkout(w);
                      }}
                      accessibilityLabel={t('home.startPlannedA11y', undefined, w.title)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.smallStartText}>{t('home.start')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.todayButtonsRow}>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.primaryButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/workout/quick-workout');
                  }}
                >
                  <Text style={styles.buttonSmallText}>{t('home.startNow')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.outlineButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/(tabs)/calendar');
                  }}
                >
                  <Text style={styles.buttonSmallText}>{t('home.viewCalendar')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.restBox}>
              <Text style={styles.restTitle}>{t('home.restTitle')}</Text>
              <Text style={styles.restText}>
                {t('home.restText')}
              </Text>

              <View style={styles.todayButtonsRow}>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.primaryButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/workout/quick-workout');
                  }}
                >
                  <Text style={styles.buttonSmallText}>{t('home.startNow')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GlassCard>

        {/* VECKANS PASS */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View style={styles.iconCircle}>
                <ListChecks size={18} color={colors.accentGreen} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('home.weekTitle')}</Text>
                <Text style={styles.cardText}>
                  {workoutsThisWeek.length > 0
                    ? t('home.weekSubHas')
                    : t('home.weekSubEmpty')}
                </Text>
              </View>
            </View>
          </View>

          {workoutsThisWeek.length > 0 ? (
            <View style={styles.weekList}>
              {[...workoutsThisWeek]
                .sort(
                  (a, b) => compareISODate(b.date, a.date)
                )
                .map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={styles.weekItem}
                    activeOpacity={0.9}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (!w.isCompleted) {
                        startPlannedWorkout(w);
                      } else {
                        router.push(`/workout/${w.id}`);
                      }
                    }}
                  >
                    <View style={styles.weekDateCol}>
                      <View
                        style={[
                          styles.weekDot,
                          { backgroundColor: w.color || colors.primary },
                        ]}
                      />
                      <Text style={styles.weekDate}>
                        {w.date.slice(5)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weekTitle}>{w.title}</Text>
                      <Text style={styles.weekMeta}>
                        {t('calendar.workoutMeta', undefined, {
                          count: w.exercises?.length || 0,
                          status: w.isCompleted ? t('history.statusDone') : t('history.statusPlanned'),
                        })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.weekPill,
                        { borderColor: w.color || colors.primary },
                      ]}
                    >
                      <Text style={styles.weekPillText}>
                        {w.isCompleted ? t('workoutDetail.setDone') : t('history.statusPlanned')}
                      </Text>
                      <ArrowUpRight size={14} color="#cbd5e1" />
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          ) : (
            <View style={styles.restBox}>
              <Text style={styles.restTitle}>{t('home.weekStartStrong')}</Text>
              <Text style={styles.restText}>
                {t('home.weekStartStrongBody')}
              </Text>
              <View style={styles.todayButtonsRow}>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.secondaryButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/schedule-workout');
                  }}
                >
                  <Text style={styles.buttonSmallText}>{t('home.weekEmptyCTA')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GlassCard>

        {/* SENASTE PASS */}
{latestWorkout && (
          <GlassCard style={styles.card} elevated={false}>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconCircle,
                    { borderColor: latestWorkout.color || colors.primary },
                  ]}
                >
                  <ListChecks size={18} color={colors.accentGreen} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{t('home.lastTitle')}</Text>
                  <Text style={styles.cardText}>
                    {latestWorkout.title} · {latestWorkout.date}
                  </Text>
                  {latestTemplateInfo ? (
                    <View style={styles.templatePill}>
                      <View
                        style={[
                          styles.templateDot,
                          { backgroundColor: latestTemplateInfo.color || colors.primary },
                        ]}
                      />
                      <Text style={styles.templatePillText}>
                        {latestTemplateInfo.name}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={[styles.streakPill, { backgroundColor: '#0b1220', borderColor: latestWorkout.color || colors.primary }]}>
                <Text style={styles.streakPillText}>
                  {latestWorkout.durationMinutes
                    ? `${latestWorkout.durationMinutes} min`
                    : t('calendar.meta.durationUnknown')}
                </Text>
              </View>
            </View>

            {latestWorkout.notes ? (
              <Text style={styles.noteSnippet} numberOfLines={2}>
                {latestWorkout.notes}
              </Text>
            ) : null}

            {latestWorkout.exercises && latestWorkout.exercises.length > 0 ? (
              <View style={styles.exerciseChips}>
                {latestWorkout.exercises.slice(0, 3).map((ex) => (
                  <View key={ex.id} style={styles.exerciseChip}>
                    <Text style={styles.exerciseChipText}>
                      {ex.name} · {t('home.latestSetCount', undefined, ex.sets)}
                    </Text>
                  </View>
                ))}
                {latestWorkout.exercises.length > 3 ? (
                  <View style={styles.exerciseChip}>
                    <Text style={styles.exerciseChipText}>
                      {t('calendar.moreExercises', undefined, latestWorkout.exercises.length - 3)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.todayBox}>
              <Text style={styles.todayLabel}>
                {t('calendar.workoutMeta', undefined, {
                  count: latestWorkout.exercises?.length ?? 0,
                  status: latestWorkout.isCompleted ? t('history.statusDone') : t('history.statusPlanned'),
                })}
              </Text>
              <View style={styles.todayButtonsRow}>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.primaryButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/workout/quick-workout',
                      params: {
                        title: latestWorkout.title,
                        color: latestWorkout.color,
                        templateId: latestWorkout.sourceTemplateId,
                      },
                    });
                  }}
                >
                  <Text style={styles.buttonSmallText}>{t('home.startAgain')}</Text>
                </TouchableOpacity>
              <TouchableOpacity
                style={[styles.buttonSmall, styles.outlineButton]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: '/workout/[id]',
                    params: { id: latestWorkout.id },
                  });
                }}
              >
                <Text style={styles.buttonSmallText}>{t('home.viewDetails')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>
      )}
        {!latestWorkout && (
          <GlassCard style={styles.card} elevated={false}>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconCircle,
                    { borderColor: colors.primary },
                  ]}
                >
                  <ListChecks size={18} color={colors.accentGreen} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>{t('home.lastEmptyTitle')}</Text>
                  <Text style={styles.cardText}>
                    {t('home.lastEmptyText')}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.todayButtonsRow}>
              <TouchableOpacity
                style={[styles.buttonSmall, styles.primaryButton]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.replace('/workout/quick-workout');
                }}
              >
                <Play size={16} color="#0b1024" />
                <Text style={styles.buttonSmallText}>{t('home.start')}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}
        </ScrollView>
      </View>
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
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    position: 'relative',
  },
  title: {
    ...typography.display,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroCard: {
    marginBottom: spacing.md,
    paddingVertical: 14,
    backgroundColor: '#0b1024cc',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  resumeCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: '#0c1024',
    paddingVertical: 12,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#1b130b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  resumeTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  resumeSubtitle: {
    ...typography.caption,
    color: colors.textSoft,
  },
  resumeMeta: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
  resumeCTA: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#0b1220',
  },
  resumeCTAText: {
    ...typography.caption,
    color: '#f97316',
    fontWeight: '800',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  heroBadgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  heroCTAText: {
    color: '#0b1024',
    fontWeight: '800',
    fontSize: 13,
  },
  streakCard: {
    marginBottom: spacing.md,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  streakBadgeText: {
    ...typography.caption,
    color: '#fb923c',
    fontWeight: '700',
  },
  streakLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  streakValue: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  streakBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#0b1024',
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  streakBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  streakHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 6,
  },

  levelCard: {
    marginTop: 8,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#0b1024',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  levelLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  levelValue: {
    ...typography.title,
    fontSize: 18,
    color: colors.textMain,
  },
  xpText: {
    ...typography.micro,
    color: colors.textSoft,
  },
  xpBarBackground: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0b1024',
    borderWidth: 1,
    borderColor: '#111827',
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  levelHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 8,
  },

  card: {
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#0b1220',
    borderColor: '#1f2937',
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPillText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '800',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#0b1024',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#111827',
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
  },

  todayBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#0b1024',
    borderWidth: 1,
    borderColor: '#111827',
  },
  todayLabel: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 6,
  },
  todayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  todayTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  todayNote: {
    ...typography.micro,
    color: colors.textSoft,
  },

  restBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#0b1024',
    borderWidth: 1,
    borderColor: '#111827',
  },
  restTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginBottom: 4,
  },
  restText: {
    ...typography.caption,
    color: colors.textSoft,
    marginBottom: 8,
  },
  weekList: {
    marginTop: 10,
    gap: 8,
  },
  weekItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#0b1024',
    borderWidth: 1,
    borderColor: '#111827',
  },
  weekDateCol: {
    alignItems: 'center',
    width: 54,
    gap: 6,
  },
  weekDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  weekDate: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '700',
  },
  weekTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  weekMeta: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 2,
  },
  weekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: '#0f172a',
  },
  weekPillText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },

  todayButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  buttonSmall: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  primaryButton: {
    backgroundColor: colors.success, // Starta pass: grön
  },
  secondaryButton: {
    backgroundColor: colors.primary, // Planera pass: lila
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  buttonSmallText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  noteSnippet: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 6,
    marginHorizontal: 2,
  },
  exerciseChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
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
  smallStartPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  smallStartText: {
    ...typography.micro,
    color: '#0b1120',
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#312e81',
    backgroundColor: '#1e1b4b',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  templateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  templatePillText: {
    color: '#c4b5fd',
    fontSize: 11,
    fontWeight: '700',
  },

});
