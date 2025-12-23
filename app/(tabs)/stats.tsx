// app/(tabs)/stats.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Dumbbell as DumbbellIcon,
  Dumbbell,
  Flame,
  Image as ImageIcon,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Calendar, DateObject } from 'react-native-calendars';
import GlassCard from '../../components/ui/GlassCard';
import GlowProgressBar from '../../components/ui/GlowProgressBar';
import NeonButton from '../../components/ui/NeonButton';
import BadgePill from '../../components/ui/BadgePill';
import { colors, gradients, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import SkeletonCard from '../../components/ui/SkeletonCard';
import { useTranslation } from '../../context/TranslationContext';

const parseRepsValue = (reps: string) => {
  if (!reps) return 0;
  const nums = reps.match(/\d+/g);
  if (!nums || nums.length === 0) return 0;
  const values = nums.map((n) => Number(n)).filter((n) => !Number.isNaN(n));
  if (values.length === 0) return 0;
  const avg = values.reduce((s, n) => s + n, 0) / values.length;
  return Math.max(0, Math.round(avg));
};

const parseWeightValue = (w?: number) => {
  if (w == null) return 0;
  const num = Number(w);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

const normalizeMuscleLabel = (name?: string) => {
  const trimmed = (name || '').trim();
  return trimmed.length > 0 ? trimmed : 'Övrigt';
};

export default function StatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workouts, weeklyGoal } = useWorkouts();
  const completedWorkouts = useMemo(
    () => (workouts || []).filter((w) => w.isCompleted),
    [workouts]
  );
  const [period, setPeriod] = useState<'7d' | '30d' | 'all' | 'custom'>('7d');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  const today = new Date();
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const formatShortDate = (d: string) => {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return d;
    return new Intl.DateTimeFormat('sv-SE', {
      day: '2-digit',
      month: 'short',
    }).format(parsed);
  };

  const todayStr = today.toISOString().slice(0, 10);
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);
  // Veckobörjan (måndag)
  const startOfWeek = useMemo(() => {
    const d = new Date(todayOnly);
    const day = d.getDay(); // 0=sön
    const diff = (day + 6) % 7; // hur många dagar sedan måndag
    d.setDate(d.getDate() - diff);
    return d;
  }, [todayOnly]);

  const startOfMonth = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }, [today]);

  const {
    workoutsThisWeek,
    workoutsThisMonth,
    totalWorkouts,
    uniqueDaysCount,
    avgPerWeek,
  } = useMemo(() => {
    if (!completedWorkouts || completedWorkouts.length === 0) {
      return {
        workoutsThisWeek: [] as typeof completedWorkouts,
        workoutsThisMonth: [] as typeof completedWorkouts,
        totalWorkouts: 0,
        uniqueDaysCount: 0,
        avgPerWeek: 0,
      };
    }

    const thisWeek = completedWorkouts.filter((w) => {
      const d = new Date(w.date);
      if (isNaN(d.getTime())) return false;
      return d >= startOfWeek && d <= todayOnly;
    });

    const thisMonth = completedWorkouts.filter((w) => {
      const d = new Date(w.date);
      if (isNaN(d.getTime())) return false;
      return d >= startOfMonth && d <= todayOnly;
    });

    const total = completedWorkouts.length;

    const uniqueDates = Array.from(new Set(completedWorkouts.map((w) => w.date)));

    // enkel uppskattning på hur många veckor loggningen spänner över
    const sortedDates = uniqueDates
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    let avg = 0;
    if (sortedDates.length >= 2) {
      const first = sortedDates[0];
      const last = sortedDates[sortedDates.length - 1];
      const diffDays =
        (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
      const weeks = Math.max(1, diffDays / 7);
      avg = total / weeks;
    } else if (sortedDates.length === 1) {
      avg = total; // allt på en vecka i praktiken
    }

    return {
      workoutsThisWeek: thisWeek,
      workoutsThisMonth: thisMonth,
      totalWorkouts: total,
      uniqueDaysCount: uniqueDates.length,
      avgPerWeek: Math.round(avg * 10) / 10,
    };
  }, [completedWorkouts, startOfWeek, startOfMonth, todayOnly]);

  // Streak-beräkning
  const streak = useMemo(() => {
    if (!completedWorkouts || completedWorkouts.length === 0) return 0;

    const uniqueDates = Array.from(
      new Set(completedWorkouts.map((w) => w.date))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let count = 0;

    const latest = new Date(uniqueDates[0]);
    const latestOnly = new Date(
      latest.getFullYear(),
      latest.getMonth(),
      latest.getDate()
    );
    const diffLatest =
      (todayOnly.getTime() - latestOnly.getTime()) /
      (1000 * 60 * 60 * 24);

    if (diffLatest > 1) return 0;

    for (let i = 0; i < uniqueDates.length; i++) {
      const d = new Date(uniqueDates[i]);
      const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diff =
        (todayOnly.getTime() - dOnly.getTime()) /
        (1000 * 60 * 60 * 24);

      if (diff === count || diff === count + 1) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }, [completedWorkouts, todayOnly]);

  const workoutsToday = completedWorkouts.filter((w) => w.date === todayStr);

  const weeklyProgressPercent =
    weeklyGoal > 0
      ? Math.min(1, workoutsThisWeek.length / weeklyGoal)
      : 0;

  // Periodfiltrering
  const periodFiltered = useMemo(() => {
    if (period === 'all') return completedWorkouts;
    if (period === 'custom' && customStart && customEnd) {
      const start = customStart <= customEnd ? customStart : customEnd;
      const end = customEnd >= customStart ? customEnd : customStart;
      return completedWorkouts.filter((w) => {
        const d = new Date(w.date);
        return d >= start && d <= end;
      });
    }
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date(todayOnly);
    cutoff.setDate(cutoff.getDate() - days + 1);
    return completedWorkouts.filter((w) => {
      const d = new Date(w.date);
      return d >= cutoff && d <= todayOnly;
    });
  }, [period, todayOnly, completedWorkouts, customStart, customEnd]);

  const volumeForPeriod = useMemo(() => {
    return periodFiltered.reduce((sum, w) => {
      const vol = (w.exercises || []).reduce((v, ex) => {
        const sets = ex.performedSets && ex.performedSets.length > 0 ? ex.performedSets : [];
        if (sets.length === 0) {
          const repsNum = parseRepsValue(ex.reps);
          return v + ex.sets * repsNum * parseWeightValue(ex.weight);
        }
        return (
          v +
          sets.reduce((acc, s) => {
            const repsNum = parseRepsValue(String(s.reps));
            const wt = parseWeightValue(s.weight);
            return acc + repsNum * wt;
          }, 0)
        );
      }, 0);
      return sum + vol;
    }, 0);
  }, [periodFiltered]);

  const [topSort, setTopSort] = useState<'sessions' | 'volume' | 'weight'>(
    'sessions'
  );

  const topExercises = useMemo(() => {
    type TopEntry = {
      name: string;
      sessions: number;
      bestWeight: number;
      lastDate: string;
      lastCompleted: boolean;
      totalVolume: number;
      lastDelta?: number | null;
    };

    const map = new Map<string, TopEntry>();
    periodFiltered.forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (!ex.name) return;
        if (!map.has(ex.name)) {
          map.set(ex.name, {
            name: ex.name,
            sessions: 0,
            bestWeight: 0,
            lastDate: w.date,
            lastCompleted: !!w.isCompleted,
            totalVolume: 0,
            lastDelta: null,
          });
        }
        const entry = map.get(ex.name)!;
        entry.sessions += 1;
        const sets = ex.performedSets || [];
        const setMax = sets.reduce(
          (m, s) => Math.max(m, parseWeightValue(s.weight)),
          0
        );
        const setVolume = sets.reduce((acc, s) => {
          const repsNum = parseRepsValue(String(s.reps));
          const wt = parseWeightValue(s.weight);
          return acc + repsNum * wt;
        }, 0);

        const exerciseMax = Math.max(parseWeightValue(ex.weight), setMax);
        entry.bestWeight = Math.max(entry.bestWeight, exerciseMax);
        entry.totalVolume += setVolume;

        if (new Date(w.date) > new Date(entry.lastDate)) {
          entry.lastDelta =
            setMax > 0 && entry.bestWeight > 0
              ? setMax - entry.bestWeight
              : null;
          entry.lastDate = w.date;
          entry.lastCompleted = !!w.isCompleted;
        }
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (topSort === 'sessions') return b.sessions - a.sessions;
      if (topSort === 'volume') return b.totalVolume - a.totalVolume;
      return b.bestWeight - a.bestWeight;
    });

    return list.slice(0, 5);
  }, [periodFiltered, topSort]);

  const miniTrends = useMemo(() => {
    // senaste 5 loggade vikter per övning (top 3 övningar)
    type TrendEntry = {
      name: string;
      values: { weight: number; date: string }[];
    };
    const map = new Map<string, { weight: number; date: string }[]>();
    periodFiltered.forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (!ex.name) return;
        const sets = ex.performedSets || [];
        if (sets.length === 0) return;
        const list = map.get(ex.name) || [];
        sets.forEach((s) => {
          const wt = parseWeightValue(s.weight);
          if (wt > 0) {
            list.push({ weight: wt, date: w.date });
          }
        });
        // sort by date and keep latest 5
        const sorted = list
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5);
        map.set(ex.name, sorted);
      });
    });
    const trends: TrendEntry[] = Array.from(map.entries())
      .map(([name, values]) => ({ name, values: values.reverse() })) // reverse to oldest -> newest
      .filter((t) => t.values.length >= 2)
      .sort((a, b) => b.values.length - a.values.length)
      .slice(0, 3);
    return trends;
  }, [completedWorkouts]);

  const muscleBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; volume: number; sessions: number }
    >();
    periodFiltered.forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        const key = normalizeMuscleLabel(ex.muscleGroup);
        if (!map.has(key)) {
          map.set(key, { name: key, count: 0, volume: 0, sessions: 0 });
        }
        const entry = map.get(key)!;
        entry.count += 1;
        const sets = ex.performedSets || [];
        const vol = sets.reduce((acc, s) => {
          const repsNum = parseRepsValue(String(s.reps));
          const wt = parseWeightValue(s.weight);
          return acc + repsNum * wt;
        }, 0);
        entry.volume += vol;
        entry.sessions += w.isCompleted ? 1 : 0;
      });
    });
    const entries = Array.from(map.values());
    const total = entries.reduce((s, e) => s + e.count, 0);
    const totalVolume = entries.reduce((s, e) => s + e.volume, 0);
    return { entries, total, totalVolume };
  }, [periodFiltered]);

  const latestPBs = useMemo(() => {
    type PBEntry = {
      name: string;
      weight: number;
      date: string;
      isCompleted: boolean;
      prevBest: number;
    };
    const sortedWorkouts = [...periodFiltered].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const map = new Map<string, PBEntry>();

    sortedWorkouts.forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (!ex.name) return;
        const sets = ex.performedSets || [];
        sets.forEach((s) => {
          const wt = parseWeightValue(s.weight);
          if (wt <= 0) return;
          const current = map.get(ex.name);
          if (!current) {
            map.set(ex.name, {
              name: ex.name,
              weight: wt,
              prevBest: 0,
              date: w.date,
              isCompleted: !!w.isCompleted,
            });
          } else if (wt > current.weight) {
            map.set(ex.name, {
              name: ex.name,
              weight: wt,
              prevBest: current.weight,
              date: w.date,
              isCompleted: !!w.isCompleted,
            });
          }
        });
      });
    });

    const pbList = Array.from(map.values()).map((pb) => {
      const pbDate = new Date(pb.date);
      const diffDays =
        (todayOnly.getTime() - pbDate.getTime()) / (1000 * 60 * 60 * 24);
      return {
        ...pb,
        delta: pb.prevBest > 0 ? pb.weight - pb.prevBest : null,
        isRecent: diffDays <= 30,
      };
    });

    return pbList
      .sort((a, b) => {
        if (b.weight === a.weight) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return b.weight - a.weight;
      })
      .slice(0, 3);
  }, [workouts, todayOnly]);

  const renderTopExercise = useCallback(
    ({ item }: { item: (typeof topExercises)[number] }) => (
      <TouchableOpacity
        style={styles.topExerciseRow}
        onPress={() =>
          router.push({
            pathname: '/exercise-progress/[name]',
            params: { name: item.name },
          })
        }
        activeOpacity={0.9}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.topExerciseName}>{item.name}</Text>
          <Text style={styles.topExerciseMeta}>
            {t('stats.topMeta', undefined, {
              sessions: item.sessions,
              last: formatShortDate(item.lastDate),
            })}
          </Text>
        </View>
          <View style={styles.topExerciseBadge}>
            <Text style={styles.topExerciseBadgeText}>
              {item.bestWeight > 0 ? `${item.bestWeight} kg` : '–'}
            </Text>
            <View style={styles.statusIconCircle}>
            {item.lastCompleted ? (
              <CheckCircle2 size={14} color={colors.accentGreen} />
            ) : (
              <Clock size={14} color={colors.textSoft} />
            )}
          </View>
        </View>
        <View style={styles.topExerciseDelta}>
          {topSort === 'volume' ? (
            <Text style={styles.topExerciseMeta}>
              {t('stats.topVolume', undefined, Math.round(item.totalVolume))}
            </Text>
          ) : (
            <Text style={styles.topExerciseMeta}>
              {t('stats.topMax', undefined, item.bestWeight > 0 ? `${item.bestWeight} kg` : '–')}
            </Text>
          )}
          {item.lastDelta != null ? (
            <Text style={styles.topExerciseDeltaText}>
              {t('stats.topDelta', undefined, item.lastDelta)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    ),
    [router, topExercises, topSort]
  );

  const [muscleSort, setMuscleSort] = useState<'percentage' | 'volume' | 'sessions'>('percentage');

  const renderMuscleRow = useCallback(
    ({ item }: { item: (typeof muscleBreakdown.entries)[number] }) => {
      const pct = muscleBreakdown.total
        ? Math.round((item.count / muscleBreakdown.total) * 100)
        : 0;
      const volPct = muscleBreakdown.totalVolume
        ? Math.round((item.volume / muscleBreakdown.totalVolume) * 100)
        : 0;
      return (
        <TouchableOpacity
          style={styles.muscleRow}
          activeOpacity={0.9}
          onPress={() =>
            router.push({
              pathname: '/exercise-progress',
              params: { muscle: item.name },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={t('stats.viewExercisesFor', undefined, item.name)}
        >
        <View style={styles.muscleLeft}>
          <View style={[styles.muscleDot, { backgroundColor: colors.primary }]} />
          <View>
            <Text style={styles.muscleName}>{item.name}</Text>
            <Text style={styles.muscleValue}>
                {t('stats.muscleMeta', undefined, {
                  sessions: item.sessions,
                  volume: Math.round(item.volume),
                })}
            </Text>
          </View>
        </View>
        <View style={styles.muscleRight}>
          <Text style={styles.musclePct}>{pct}%</Text>
            <View style={styles.muscleBarBg}>
              <View
                style={[
                  styles.muscleBarFill,
                  { width: `${Math.min(100, pct)}%` },
                ]}
              />
            </View>
            <Text style={styles.muscleSubPct}>{t('stats.muscleSubPct', undefined, volPct)}</Text>
        </View>
      </TouchableOpacity>
    );
  },
    [muscleBreakdown.total, muscleBreakdown.totalVolume, router]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.full}>
        <LinearGradient
          colors={gradients.appBackground}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.title}>{t('stats.title')}</Text>
        <Text style={styles.subtitle}>{t('stats.subtitle')}</Text>

        {/* Periodfilter */}
        <View style={styles.filterRow}>
        {(['7d', '30d', 'all', 'custom'] as const).map((p) => {
          const active = period === p.key;
          return (
            <BadgePill
              key={p}
              label={t(`stats.filters.${p}`)}
              tone={active ? 'primary' : 'neutral'}
              style={styles.filterChip}
              onPress={() => {
                Haptics.selectionAsync();
                setPeriod(p);
                if (p === 'custom') {
                  setShowCustomPicker(true);
                }
              }}
              accessibilityLabel={`Filtrera period ${t(`stats.filters.${p}`)}`}
              accessibilityRole="button"
            />
          );
        })}
      </View>

      {/* VECKOSAMMANFATTNING */}
      <GlassCard style={styles.card} elevated={false}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircle}>
              <Activity size={18} color={colors.accentGreen} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{t('stats.weekTitle', 'Veckomål & streak')}</Text>
              <Text style={styles.cardText}>
                {t('stats.weekSubtitle', 'Hur du ligger till mot målet och din aktuella streak.')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.weekStatsRow}>
          <View style={styles.weekStatBox}>
            <Text style={styles.statLabel}>{t('stats.passesThisWeek', 'Pass denna vecka')}</Text>
            <Text style={styles.statValue}>
              {workoutsThisWeek.length}
            </Text>
          </View>
          <View style={styles.weekStatBox}>
            <Text style={styles.statLabel}>{t('stats.weekGoal', 'Veckomål')}</Text>
            <Text style={styles.statValue}>{weeklyGoal}</Text>
          </View>
          <View style={styles.weekStatBox}>
            <Text style={styles.statLabel}>{t('stats.streak', 'Streak')}</Text>
            <Text style={styles.statValue}>
              {streak} {t('stats.days', 'dagar')}
            </Text>
          </View>
        </View>

        <GlowProgressBar value={weeklyProgressPercent} />
        <Text style={styles.progressLabel}>
          {weeklyGoal > 0
            ? t('stats.weekProgress', undefined, { done: workoutsThisWeek.length, goal: weeklyGoal }) ||
              `${workoutsThisWeek.length}/${weeklyGoal} pass avklarade`
            : t('stats.noWeekGoal', 'Inget veckomål satt ännu.')}
        </Text>
      </GlassCard>

        {/* TOTAL PROGRESS */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircle}>
              <BarChart3 size={18} color={colors.accentBlue} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{t('stats.totalTitle', 'Total utveckling')}</Text>
              <Text style={styles.cardText}>
                {t('stats.totalSubtitle', 'Summering av alla pass du har loggat i appen.')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.statLabel}>{t('stats.totalSessions', 'Totalt antal pass')}</Text>
            <Text style={styles.statValue}>
              {totalWorkouts}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.statLabel}>{t('stats.uniqueDays', 'Aktiva träningsdagar')}</Text>
            <Text style={styles.statValue}>
              {uniqueDaysCount}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.statLabel}>{t('stats.avgPerWeek', 'Snitt / vecka')}</Text>
            <Text style={styles.statValue}>
              {avgPerWeek.toFixed(1)}
            </Text>
          </View>
        </View>

        <View style={styles.monthRow}>
          <View style={styles.monthItem}>
            <Text style={styles.statLabel}>{t('stats.monthSessions', 'Pass denna månad')}</Text>
            <Text style={styles.statValue}>
              {workoutsThisMonth.length}
            </Text>
          </View>
          <View style={styles.monthItem}>
            <Text style={styles.statLabel}>
              {t('stats.periodVolume', 'Volym')} ({t(`stats.filters.${period}`)})
            </Text>
            <Text style={styles.statValue}>{volumeForPeriod}</Text>
          </View>
        </View>
      </GlassCard>

        {/* STREAK / FOKUS */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Trophy size={18} color="#facc15" />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('stats.pbTitle', 'PB & highlights')}</Text>
                <Text style={styles.cardText}>
                  {t('stats.pbSubtitle', 'Dina senaste tyngsta lyft i perioden.')}
                </Text>
              </View>
            </View>
          </View>

          {latestPBs.length === 0 ? (
            completedWorkouts.length === 0 ? (
              <View style={styles.pbEmpty}>
                <Text style={styles.emptyText}>
                  {t('stats.pbEmptyFirst', 'Inga pass ännu – logga ett pass för att se dina PB här.')}
                </Text>
                <View style={styles.pbEmptyActions}>
                  <TouchableOpacity
                    style={[styles.pbEmptyButton, styles.primaryButton]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/workout/quick-workout');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.start', 'Starta pass')}
                  >
                    <Text style={styles.pbEmptyButtonText}>{t('home.start')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pbEmptyButton, styles.secondaryButton]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/schedule-workout');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.weekEmptyCTA', 'Planera pass')}
                  >
                    <Text style={styles.pbEmptyButtonText}>{t('home.weekEmptyCTA', 'Planera')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {t('stats.pbEmpty', 'Inga PB registrerade ännu. Logga vikter i dina pass för att se highlights här.')}
              </Text>
            )
          ) : (
            latestPBs.map((pb) => (
              <TouchableOpacity
                key={`${pb.name}-${pb.date}`}
                style={styles.pbRow}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({
                    pathname: '/exercise-progress/[name]',
                    params: { name: pb.name },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('stats.viewExercisesFor', `Visa progression för ${pb.name}`, pb.name)}
              >
                <Text style={styles.pbName}>{pb.name}</Text>
                <View style={styles.pbRight}>
                  <View style={styles.statusIconCircle}>
                    {pb.isCompleted ? (
                      <CheckCircle2 size={14} color={colors.accentGreen} />
                    ) : (
                      <Clock size={14} color={colors.textSoft} />
                    )}
                  </View>
                  <Text style={styles.pbWeight}>{pb.weight} kg</Text>
                  {pb.delta != null ? (
                    <Text style={styles.pbDelta}>
                      {t('stats.pbDelta', undefined, pb.delta)}
                    </Text>
                  ) : null}
                  <View style={styles.pbDateRow}>
                    <Text style={styles.pbDate}>{formatShortDate(pb.date)}</Text>
                    {pb.isRecent ? (
                      <View style={styles.pbRecentPill}>
                        <Text style={styles.pbRecentText}>Ny</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </GlassCard>

        {/* ÖVNINGS-PROGRESS LINK */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Dumbbell size={18} color={colors.accentBlue} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('stats.progressTitle', 'Övningsprogress')}</Text>
                <Text style={styles.cardText}>
                  {t('stats.progressSubtitle', 'Se utvecklingen för varje övning – vikter, volym och historik.')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressInfoRow}>
            <Text style={styles.progressInfoText}>
              {t('stats.progressSummary', undefined, muscleBreakdown.total)}
            </Text>
            {topExercises[0]?.name ? (
              <Text style={styles.progressInfoSub}>
                {t('stats.progressLatest', undefined, topExercises[0].name)}
              </Text>
            ) : null}
          </View>

          <View style={styles.progressChips}>
            {((t('stats.progressChips') as unknown as string[]) || []).map((label) => (
              <View key={label} style={styles.progressChip}>
                <Text style={styles.progressChipText}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.progressButtons}>
            <TouchableOpacity
              style={[styles.pbEmptyButton, styles.primaryButton]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/exercise-progress');
              }}
              accessibilityLabel="Visa alla övningar"
              accessibilityRole="button"
            >
              <Text style={styles.pbEmptyButtonText}>{t('stats.progressShowAll', 'Visa övningar')}</Text>
            </TouchableOpacity>
            {topExercises[0]?.name ? (
              <TouchableOpacity
                style={[styles.pbEmptyButton, styles.secondaryButton]}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: '/exercise-progress/[name]',
                    params: { name: topExercises[0].name },
                  });
                }}
                accessibilityLabel={`Öppna ${topExercises[0].name}`}
                accessibilityRole="button"
              >
                <Text style={styles.pbEmptyButtonText}>{t('stats.progressShowLatest', 'Senaste övning')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </GlassCard>

        {/* TOPP-ÖVNINGAR */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <TrendingUp size={18} color={colors.accentGreen} />
              </View>
              <View>
                <Text style={styles.cardTitle}>
                  {t('stats.topTitle', 'Toppövningar')} ({t(`stats.filters.${period}`)})
                </Text>
                <Text style={styles.cardText}>
                  {t('stats.topSubtitle', 'Mest körda övningarna i perioden – tryck för detalj.')}
                </Text>
              </View>
            </View>
            <View style={styles.filterRow}>
              {[
                { key: 'sessions', label: t('stats.muscleSortSessions', 'Pass') },
                { key: 'volume', label: t('stats.muscleSortVolume', 'Volym') },
                { key: 'weight', label: t('stats.muscleSortWeight', 'Vikt') },
              ].map((opt) => {
                const active = topSort === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.topSortChip,
                      active && styles.topSortChipActive,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTopSort(opt.key as typeof topSort);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Sortera toppövningar på ${opt.label}`}
                  >
                    <Text
                      style={[
                        styles.topSortText,
                        active && styles.topSortTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {topExercises.length === 0 ? (
            completedWorkouts.length === 0 ? (
              <>
                <SkeletonCard height={60} />
                <SkeletonCard height={60} />
              </>
            ) : (
              <Text style={styles.emptyText}>
                {t('stats.topEmpty', 'Inga loggade övningar i vald period.')}
              </Text>
            )
          ) : (
            <FlatList
              data={topExercises}
              keyExtractor={(item) => item.name}
              renderItem={renderTopExercise}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
              accessible
              accessibilityRole="list"
              accessibilityLabel={t('stats.topListLabel', 'Toppövningar')}
            />
          )}
        </GlassCard>

        {/* MUSKELGRUPPER */}
        <GlassCard style={styles.card} elevated={false}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Activity size={18} color={colors.accentGreen} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('stats.muscleTitle', 'Muskelgrupper')}</Text>
                <Text style={styles.cardText}>
                  {t('stats.muscleSubtitle', 'Fördelning av loggade övningar per muskelgrupp.')}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.filterRow}>
            {[
              { key: 'percentage', label: t('stats.muscleSortPercentage', 'Andel') },
              { key: 'volume', label: t('stats.muscleSortVolume', 'Volym') },
              { key: 'sessions', label: t('stats.muscleSortSessions', 'Pass') },
            ].map((opt) => {
              const active = muscleSort === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.topSortChip,
                    active && styles.topSortChipActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMuscleSort(opt.key as typeof muscleSort);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Sortera muskelgrupper på ${opt.label}`}
                >
                  <Text
                    style={[
                      styles.topSortText,
                      active && styles.topSortTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {muscleBreakdown.total === 0 ? (
            completedWorkouts.length === 0 ? (
              <>
                <SkeletonCard height={60} />
                <SkeletonCard height={60} />
              </>
            ) : (
              <Text style={styles.emptyText}>
                {t('stats.muscleEmpty', 'Inga loggade övningar ännu.')}
              </Text>
            )
          ) : (
            <FlatList
              data={[...muscleBreakdown.entries].sort((a, b) => {
                if (muscleSort === 'percentage') {
                  const aPct = muscleBreakdown.total
                    ? a.count / muscleBreakdown.total
                    : 0;
                  const bPct = muscleBreakdown.total
                    ? b.count / muscleBreakdown.total
                    : 0;
                  return bPct - aPct;
                }
                if (muscleSort === 'volume') return b.volume - a.volume;
                return b.sessions - a.sessions;
              })}
              keyExtractor={(item) => item.name}
              renderItem={renderMuscleRow}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
              accessible
              accessibilityRole="list"
              accessibilityLabel={t('stats.muscleTitle', 'Muskelgrupper')}
            />
          )}
        </GlassCard>

        </ScrollView>
      </View>
      <Modal
        visible={showCustomPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowCustomPicker(false);
              }}
              accessibilityLabel={t('stats.closeDatePicker', 'Stäng datumväljaren')}
              accessibilityRole="button"
            >
              <X size={16} color={colors.textSoft} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('stats.datePickerTitle')}</Text>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t('stats.startLabel')}</Text>
              <TouchableOpacity
                style={styles.modalDate}
                onPress={() => {
                  setActivePicker('start');
                  setShowCustomPicker(true);
                }}
                accessibilityLabel={t('stats.pickStart', 'Välj startdatum')}
                accessibilityRole="button"
              >
                <Text style={styles.modalDateText}>
                  {customStart ? formatDate(customStart) : t('stats.startPlaceholder')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t('stats.endLabel')}</Text>
              <TouchableOpacity
                style={styles.modalDate}
                onPress={() => {
                  setActivePicker('end');
                  setShowCustomPicker(true);
                }}
                accessibilityLabel={t('stats.pickEnd', 'Välj slutdatum')}
                accessibilityRole="button"
              >
                <Text style={styles.modalDateText}>
                  {customEnd ? formatDate(customEnd) : t('stats.endPlaceholder')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  const start = customStart || todayOnly;
                  const end = customEnd || todayOnly;
                  const orderedStart = start <= end ? start : end;
                  const orderedEnd = end >= start ? end : start;
                  setCustomStart(orderedStart);
                  setCustomEnd(orderedEnd);
                  setPeriod('custom');
                  setShowCustomPicker(false);
                  setActivePicker(null);
                }}
              >
                <Text style={styles.modalButtonText}>{t('stats.confirm')}</Text>
              </TouchableOpacity>
            </View>
          {activePicker && (
            <View style={styles.popover}>
              <Calendar
                current={
                  activePicker === 'start'
                    ? formatDate(customStart || todayOnly)
                    : formatDate(customEnd || todayOnly)
                }
                onDayPress={(day) => {
                  const picked = new Date(day.dateString);
                  if (activePicker === 'start') {
                    setCustomStart(picked);
                    if (!customEnd || picked > customEnd) {
                      setCustomEnd(picked);
                    }
                  } else if (activePicker === 'end') {
                    setCustomEnd(picked);
                    if (!customStart || picked > customStart) {
                      setCustomStart(customStart || picked);
                    }
                  }
                  setPeriod('custom');
                }}
                markedDates={{
                  ...(customStart
                    ? {
                        [formatDate(customStart)]: {
                          selected: true,
                          selectedColor: colors.primary,
                          selectedTextColor: '#0b1120',
                        },
                      }
                    : {}),
                  ...(customEnd
                    ? {
                        [formatDate(customEnd)]: {
                          selected: true,
                          selectedColor: colors.accentGreen,
                          selectedTextColor: '#0b1120',
                        },
                      }
                    : {}),
                }}
                theme={{
                  backgroundColor: '#0b1220',
                  calendarBackground: '#0b1220',
                  monthTextColor: colors.textMain,
                  dayTextColor: colors.textMain,
                  textDisabledColor: '#4b5563',
                  arrowColor: colors.textMain,
                }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
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
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
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
  card: {
    marginTop: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
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

  // Veckosammanfattning
  weekStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  weekStatBox: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#111827',
  },
  statLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  statValue: {
    ...typography.title,
    fontSize: 16,
    color: colors.textMain,
    marginTop: 2,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    marginTop: 8,
  },
  progressLabel: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 4,
  },

  // Total progress
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#111827',
  },
  monthRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  monthItem: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#111827',
  },

  // Streak
  streakRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#111827',
  },
  streakText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  streakHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 8,
  },

  // Buttons
  button: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueButton: {
    backgroundColor: colors.accentBlue,
  },
  purpleButton: {
    backgroundColor: colors.accentPurple,
  },
  buttonText: {
    ...typography.bodyBold,
    color: '#0b1120',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: colors.backgroundSoft,
  },
  filterChipActive: {
    borderColor: colors.accentGreen,
    backgroundColor: '#1b0f32',
  },
  filterText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#bbf7d0',
  },
  pbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  pbName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  pbRight: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 120,
  },
  pbWeight: {
    ...typography.bodyBold,
    color: colors.accentGreen,
  },
  pbDelta: {
    ...typography.micro,
    color: colors.accentBlue,
    fontWeight: '700',
  },
  pbDate: {
    ...typography.micro,
    color: colors.textSoft,
  },
  pbDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pbRecentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pbRecentText: {
    ...typography.micro,
    color: colors.textMain,
    fontSize: 10,
    fontWeight: '700',
  },
  pbEmpty: {
    gap: 8,
  },
  pbEmptyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pbEmptyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  pbEmptyButtonText: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: 'transparent',
    borderColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#334155',
  },
  progressInfoRow: {
    marginTop: 6,
    marginBottom: 6,
    gap: 2,
  },
  progressInfoText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  progressInfoSub: {
    ...typography.micro,
    color: colors.textSoft,
  },
  progressChips: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  progressChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  progressChipText: {
    ...typography.micro,
    color: colors.textMuted,
    fontWeight: '700',
  },
  progressButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  topSortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: colors.backgroundSoft,
  },
  topSortChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  topSortText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  topSortTextActive: {
    color: colors.textMain,
  },
  topExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSoft,
  },
  topExerciseName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  topExerciseMeta: {
    ...typography.micro,
    color: colors.textSoft,
  },
  topExerciseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topExerciseBadgeText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  topExerciseDelta: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 110,
  },
  topExerciseDeltaText: {
    ...typography.micro,
    color: colors.accentBlue,
    fontWeight: '700',
  },
  muscleRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  muscleName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  muscleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  muscleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  muscleValue: {
    ...typography.micro,
    color: colors.textSoft,
  },
  muscleRight: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 120,
  },
  musclePct: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  muscleSubPct: {
    ...typography.micro,
    color: colors.textSoft,
  },
  muscleBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#111827',
    overflow: 'hidden',
    width: 120,
  },
  muscleBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  coachText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  modalTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 10,
    marginTop: 4,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  modalDate: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  modalDateText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.backgroundSoft,
    borderColor: '#1f2937',
  },
  modalButtonText: {
    color: '#0b1120',
    fontWeight: '700',
    fontSize: 12,
  },
  statusIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  popover: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 8,
  },
  modalClose: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
});
