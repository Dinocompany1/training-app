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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../../components/ui/GlassCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import StaggerReveal from '../../components/ui/StaggerReveal';
import { colors, gradients, spacing, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { getWeekRange, isDateInRange } from '../../utils/weekRange';
import {
  loadOngoingQuickWorkout,
  type OngoingQuickWorkoutSnapshot,
} from '../../utils/ongoingQuickWorkout';
import { compareISODate, parseISODate } from '../../utils/date';
import { sortWorkoutsByRecencyDesc } from '../../utils/workoutRecency';

const todayISOFor = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const { workouts, weeklyGoal, templates } = useWorkouts();
  const { t } = useTranslation();
  const [ongoingSnapshot, setOngoingSnapshot] = React.useState<OngoingQuickWorkoutSnapshot | null>(null);
  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  const todayStr = useMemo(() => todayISOFor(currentDate), [currentDate]);
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
  const dedupedAllWorkouts = useMemo(() => dedupeWorkouts(workouts), [dedupeWorkouts, workouts]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const workoutsToday = useMemo(() => {
    const todays = dedupedAllWorkouts.filter((w) => w.date === todayStr);
    return todays.sort((a, b) =>
      a.isCompleted === b.isCompleted ? 0 : a.isCompleted ? -1 : 1
    );
  }, [dedupedAllWorkouts, todayStr]);

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
    if (dedupedAllWorkouts.length === 0) return null;
    // Visa endast senaste avslutade passet
    const completed = dedupedAllWorkouts.filter((w) => w.isCompleted);
    if (completed.length === 0) return null;
    return sortWorkoutsByRecencyDesc(completed)[0];
  }, [dedupedAllWorkouts]);
  const latestTemplateInfo = useMemo(() => {
    if (!latestWorkout?.sourceTemplateId) return null;
    const t = templates.find((tpl) => tpl.id === latestWorkout.sourceTemplateId);
    return t ? { name: t.name, color: t.color } : null;
  }, [latestWorkout, templates]);
  const weekRange = useMemo(() => getWeekRange(currentDate), [currentDate]);

  const workoutsThisWeek = useMemo(() => {
    const inRange = dedupedAllWorkouts.filter(
      (w) => w.isCompleted && isDateInRange(w.date, weekRange.start, weekRange.end)
    );
    return inRange;
  }, [dedupedAllWorkouts, weekRange]);

  const refreshOngoing = useCallback(() => {
    loadOngoingQuickWorkout<OngoingQuickWorkoutSnapshot>().then((snap) => {
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
    if (dedupedAllWorkouts.length === 0) return 0;

    const uniqueDates = Array.from(
      new Set(dedupedAllWorkouts.map((w) => w.date))
    ).sort((a, b) => compareISODate(b, a));

    let count = 0;
    const parsedToday = parseISODate(todayStr) ?? currentDate;
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
  }, [dedupedAllWorkouts, currentDate, todayStr]);

  const hasWorkoutToday = workoutsToday.length > 0;
  const plannedToday = useMemo(
    () => workoutsToday.filter((w) => !w.isCompleted),
    [workoutsToday]
  );
  const nextPlannedWorkout = useMemo(() => {
    if (plannedToday.length > 0) return plannedToday[0];
    return [...dedupedAllWorkouts]
      .filter((w) => !w.isCompleted && w.date >= todayStr)
      .sort((a, b) => compareISODate(a.date, b.date))[0] || null;
  }, [plannedToday, dedupedAllWorkouts, todayStr]);
  const weekLeft = Math.max(0, (weeklyGoal || 0) - workoutsThisWeek.length);
  const weekDayData = useMemo(() => {
    const labels = [
      t('home.dayMon'),
      t('home.dayTue'),
      t('home.dayWed'),
      t('home.dayThu'),
      t('home.dayFri'),
      t('home.daySat'),
      t('home.daySun'),
    ];
    const deduped = dedupeWorkouts(workouts);
    return labels.map((label, index) => {
      const date = new Date(weekRange.start);
      date.setDate(weekRange.start.getDate() + index);
      const iso = todayISOFor(date);
      const dayItems = deduped.filter((w) => w.date === iso);
      const hasDone = dayItems.some((w) => w.isCompleted);
      const hasPlanned = dayItems.some((w) => !w.isCompleted);
      return {
        label,
        iso,
        isToday: iso === todayStr,
        status: hasDone ? 'done' : hasPlanned ? 'planned' : 'empty',
      };
    });
  }, [t, dedupeWorkouts, workouts, weekRange.start, todayStr]);
  const quickTemplates = useMemo(() => templates.slice(0, 3), [templates]);
  const todayFocus = useMemo(() => {
    if (ongoingSnapshot) {
      return {
        title: t('home.focusResumeTitle'),
        body: t('home.focusResumeBody'),
        cta: t('common.resumeButton'),
        action: () =>
          router.push({
            pathname: '/workout/quick-workout',
            params: {
              resume: '1',
              resumeSnapshot: encodeURIComponent(JSON.stringify(ongoingSnapshot)),
            },
          }),
      };
    }
    if (nextPlannedWorkout) {
      return {
        title: t('home.focusPlanTitle'),
        body: t('home.focusPlanBody', undefined, {
          title: nextPlannedWorkout.title,
          date: nextPlannedWorkout.date,
        }),
        cta: t('home.start'),
        action: () => startPlannedWorkout(nextPlannedWorkout),
      };
    }
    if (weekLeft > 0) {
      return {
        title: t('home.focusGoalTitle'),
        body: t('home.focusGoalBody', undefined, { left: weekLeft }),
        cta: t('home.focusGoalCta'),
        action: () => router.push('/(tabs)/calendar'),
      };
    }
    return {
      title: t('home.focusDoneTitle'),
      body: t('home.focusDoneBody'),
      cta: t('home.focusDoneCta'),
      action: () => router.push('/(tabs)/stats'),
    };
  }, [ongoingSnapshot, nextPlannedWorkout, weekLeft, t, router, startPlannedWorkout]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
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
          <StaggerReveal delay={20}>
            <GlassCard style={styles.resumeCard} elevated={false}>
              <View style={styles.resumeHeader}>
                <View style={styles.resumeIconWrap}>
                  <Play size={16} color={colors.warning} />
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
                      borderColor: colors.warning,
                      backgroundColor: 'rgba(245,158,11,0.14)',
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
          </StaggerReveal>
        )}

        <StaggerReveal delay={60}>
          <GlassCard style={styles.heroCard} elevated={false}>
          <View style={styles.heroGradient}>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
              <ScreenHeader
                title={t('home.heroTitle')}
                subtitle={t('home.heroSubtitle')}
                tone="blue"
                style={styles.heroHeader}
              />
              <View style={styles.heroBadges}>
                <View style={styles.heroBadge}>
                  <Flame size={14} color={colors.warning} />
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
                accessibilityRole="button"
                accessibilityLabel={t('home.start')}
              >
                <Play size={16} color={colors.textMain} />
                <Text style={styles.heroCTAText}>{t('home.start')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </GlassCard>
        </StaggerReveal>

        <StaggerReveal delay={100}>
          <GlassCard style={styles.focusCard} elevated={false} tone="violet">
          <Text style={styles.focusKicker}>{t('home.focusKicker')}</Text>
          <Text style={styles.focusTitle}>{todayFocus.title}</Text>
          <Text style={styles.focusBody}>{todayFocus.body}</Text>
          <TouchableOpacity
            style={styles.focusCTA}
            onPress={() => {
              Haptics.selectionAsync();
              todayFocus.action();
            }}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={todayFocus.cta}
          >
            <Text style={styles.focusCTAText}>{todayFocus.cta}</Text>
          </TouchableOpacity>
          </GlassCard>
        </StaggerReveal>

        <StaggerReveal delay={140}>
          <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickActionCard, styles.quickActionPrimary]}
            activeOpacity={0.9}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/workout/quick-workout');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('home.quickStartTitle')}
          >
            <Play size={18} color={colors.textMain} />
            <Text style={styles.quickActionPrimaryTitle}>{t('home.quickStartTitle')}</Text>
            <Text style={styles.quickActionPrimarySub}>{t('home.quickStartBody')}</Text>
          </TouchableOpacity>

          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[
                styles.quickActionCard,
                styles.quickActionHalf,
                !nextPlannedWorkout ? styles.quickActionDisabled : null,
              ]}
              activeOpacity={0.9}
              disabled={!nextPlannedWorkout}
              onPress={() => {
                if (!nextPlannedWorkout) return;
                Haptics.selectionAsync();
                startPlannedWorkout(nextPlannedWorkout);
              }}
            >
              <CalendarClock size={16} color={colors.primary} />
              <Text style={styles.quickActionTitle}>{t('home.quickContinueTitle')}</Text>
              <Text style={styles.quickActionSub}>
                {nextPlannedWorkout
                  ? t('home.quickContinueBody', undefined, { title: nextPlannedWorkout.title })
                  : t('home.quickContinueEmpty')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionCard, styles.quickActionHalf]}
              activeOpacity={0.9}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(tabs)/calendar');
              }}
            >
              <ListChecks size={16} color={colors.accentGreen} />
              <Text style={styles.quickActionTitle}>{t('home.quickWeekTitle')}</Text>
              <Text style={styles.quickActionSub}>{t('home.quickWeekBody')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </StaggerReveal>

        <StaggerReveal delay={180}>
          <GlassCard style={styles.rhythmCard} elevated={false}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{t('home.rhythmTitle')}</Text>
            <Text style={styles.cardText}>{t('home.rhythmSubtitle')}</Text>
          </View>
          <View style={styles.rhythmRow}>
            {weekDayData.map((day) => (
              <TouchableOpacity
                key={day.iso}
                style={[
                  styles.dayPill,
                  day.status === 'done'
                    ? styles.dayPillDone
                    : day.status === 'planned'
                    ? styles.dayPillPlanned
                    : styles.dayPillEmpty,
                  day.isToday ? styles.dayPillToday : null,
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/(tabs)/calendar');
                }}
              >
                <Text style={styles.dayLabel}>{day.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          </GlassCard>
        </StaggerReveal>

        <StaggerReveal delay={220}>
          <GlassCard style={styles.templatesQuickCard} elevated={false}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{t('home.quickTemplatesTitle')}</Text>
            <TouchableOpacity
              style={styles.templatesAllBtn}
              activeOpacity={0.9}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/templates');
              }}
            >
              <Text style={styles.templatesAllText}>{t('home.quickTemplatesAll')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardText}>{t('home.quickTemplatesSubtitle')}</Text>
          {quickTemplates.length > 0 ? (
            <View style={styles.quickTemplatesList}>
              {quickTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.quickTemplateItem}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/workout/quick-workout',
                      params: {
                        templateId: template.id,
                        title: template.name,
                        color: template.color,
                      },
                    });
                  }}
                >
                  <View style={[styles.templateColorDot, { backgroundColor: template.color || colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickTemplateTitle}>{template.name}</Text>
                    <Text style={styles.quickTemplateMeta}>
                      {t('home.quickTemplateMeta', undefined, template.exercises?.length || 0)}
                    </Text>
                  </View>
                  <ArrowUpRight size={15} color={colors.textSoft} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.restBox}>
              <Text style={styles.restText}>{t('home.quickTemplatesEmpty')}</Text>
            </View>
          )}
          </GlassCard>
        </StaggerReveal>

        {/* DAGENS PASS */}
        <StaggerReveal delay={260}>
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
                  <Text style={[styles.buttonSmallText, styles.buttonSmallTextOnLight]}>
                    {t('home.startNow')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.outlineButton]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/(tabs)/calendar');
                  }}
                >
                  <Text style={[styles.buttonSmallText, styles.buttonSmallTextOutline]}>
                    {t('home.viewCalendar')}
                  </Text>
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
                  <Text style={[styles.buttonSmallText, styles.buttonSmallTextOnLight]}>
                    {t('home.startNow')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          </GlassCard>
        </StaggerReveal>

        {/* SENASTE PASS */}
{latestWorkout && !hasWorkoutToday && (
          <StaggerReveal delay={300}>
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
              <View style={[styles.streakPill, { backgroundColor: colors.backgroundSoft, borderColor: latestWorkout.color || colors.primary }]}>
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
                  <Text style={[styles.buttonSmallText, styles.buttonSmallTextOnLight]}>
                    {t('home.startAgain')}
                  </Text>
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
                <Text style={[styles.buttonSmallText, styles.buttonSmallTextOutline]}>
                  {t('home.viewDetails')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
            </GlassCard>
          </StaggerReveal>
      )}
        {!latestWorkout && !hasWorkoutToday && (
          <StaggerReveal delay={300}>
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
                  router.push('/workout/quick-workout');
                }}
              >
                <Play size={16} color={colors.textMain} />
                <Text style={[styles.buttonSmallText, styles.buttonSmallTextOnLight]}>
                  {t('home.start')}
                </Text>
              </TouchableOpacity>
            </View>
            </GlassCard>
          </StaggerReveal>
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
    paddingTop: spacing.lg,
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
    marginBottom: spacing.lg,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  heroGradient: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  resumeCard: {
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
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
    backgroundColor: 'rgba(245,158,11,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
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
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  resumeCTAText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '800',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroHeader: {
    marginBottom: 0,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  heroBadgeText: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '700',
  },
  heroCTA: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  heroCTAText: {
    color: colors.textMain,
    fontWeight: '800',
    fontSize: 13,
  },
  streakCard: {
    marginBottom: spacing.md,
  },
  focusCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  focusKicker: {
    ...typography.micro,
    color: colors.primaryBright,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  focusTitle: {
    ...typography.title,
    color: colors.textMain,
    marginTop: 4,
  },
  focusBody: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
  },
  focusCTA: {
    marginTop: 10,
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  focusCTAText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '800',
  },
  quickActionsGrid: {
    marginBottom: spacing.lg,
    gap: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionCard: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    minHeight: 82,
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  quickActionHalf: {
    flex: 1,
  },
  quickActionPrimary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.cardBorder,
  },
  quickActionDisabled: {
    opacity: 0.55,
  },
  quickActionPrimaryTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '900',
  },
  quickActionPrimarySub: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
    opacity: 0.95,
  },
  quickActionTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '800',
  },
  quickActionSub: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 1,
    lineHeight: 15,
  },
  rhythmCard: {
    marginBottom: spacing.lg,
  },
  rhythmRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  dayPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillDone: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: colors.accentGreen,
  },
  dayPillPlanned: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  dayPillEmpty: {
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.cardBorder,
  },
  dayPillToday: {
    borderColor: colors.warning,
    borderWidth: 2,
  },
  dayLabel: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '800',
  },
  templatesQuickCard: {
    marginBottom: spacing.lg,
  },
  templatesAllBtn: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templatesAllText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '800',
  },
  quickTemplatesList: {
    marginTop: 10,
    gap: 8,
  },
  quickTemplateItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  quickTemplateTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '700',
  },
  quickTemplateMeta: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
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
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  streakBadgeText: {
    ...typography.caption,
    color: colors.warning,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  levelHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 8,
  },

  card: {
    marginTop: spacing.lg,
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
    backgroundColor: colors.backgroundSoft,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 3,
  },

  todayBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  todayLabel: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 8,
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
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  restTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginBottom: 4,
  },
  restText: {
    ...typography.caption,
    color: colors.textSoft,
    marginBottom: 10,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.surface,
  },
  weekPillText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },

  todayButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  buttonSmall: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  primaryButton: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBright,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.cardBorder,
  },
  outlineButton: {
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  buttonSmallText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '800',
  },
  buttonSmallTextOnLight: {
    color: colors.textMain,
    fontWeight: '800',
  },
  buttonSmallTextOutline: {
    color: colors.textSoft,
  },
  noteSnippet: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 8,
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
  smallStartPill: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  smallStartText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  templateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  templatePillText: {
    color: colors.primaryBright,
    fontSize: 11,
    fontWeight: '700',
  },

});
