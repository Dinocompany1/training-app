// app/(tabs)/stats.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  Sparkles,
  Clock,
  Dumbbell,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import GlassCard from '../../components/ui/GlassCard';
import BadgePill from '../../components/ui/BadgePill';
import ScreenHeader from '../../components/ui/ScreenHeader';
import StaggerReveal from '../../components/ui/StaggerReveal';
import { colors, gradients, layout, radii, spacing, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { compareISODate, formatDateShort, parseISODate, toISODate } from '../../utils/date';
import { parseRepsValue } from '../../utils/reps';
import storage from '../../utils/safeStorage';
import { getAIInsight, type AIInsightResponse, type AIInsightRequest } from '../../utils/aiInsights';

type TrendMetric = 'sessions' | 'minutes' | 'volume';
type StatsPeriod = '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';

const parseWeightValue = (w?: number) => {
  if (w == null) return 0;
  const num = Number(w);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeekDate = (date: Date) => {
  const dayOnly = startOfDay(date);
  const day = dayOnly.getDay();
  const diff = (day + 6) % 7;
  dayOnly.setDate(dayOnly.getDate() - diff);
  return dayOnly;
};

const getPeriodDays = (period: StatsPeriod): number | null => {
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  if (period === 'year') return 365;
  return null;
};

type WorkoutLike = {
  exercises?: {
    sets?: number;
    reps?: string;
    weight?: number;
    performedSets?: { reps: string; weight?: number }[];
  }[];
};

const workoutVolume = (workout: WorkoutLike) =>
  (workout.exercises || []).reduce((v, ex) => {
    const sets = ex.performedSets && ex.performedSets.length > 0 ? ex.performedSets : [];
    if (sets.length === 0) {
      const repsNum = parseRepsValue(ex.reps || '');
      return v + (ex.sets || 0) * repsNum * parseWeightValue(ex.weight);
    }
    return (
      v +
      sets.reduce((acc: number, s: { reps: string; weight?: number }) => {
        const repsNum = parseRepsValue(String(s.reps));
        const wt = parseWeightValue(s.weight);
        return acc + repsNum * wt;
      }, 0)
    );
  }, 0);

const formatTrendMetricValue = (
  value: number,
  metric: TrendMetric,
  t: (path: string, fallback?: string | ((...args: any[]) => string), args?: any) => string
) => {
  if (metric === 'sessions') return t('stats.trendMetricSessionsValue', undefined, Math.round(value));
  if (metric === 'minutes') return t('stats.trendMetricMinutesValue', undefined, Math.round(value));
  return t('stats.trendMetricVolumeValue', undefined, Math.round(value));
};

export default function StatsScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { workouts, weeklyGoal } = useWorkouts();
  const completedWorkouts = useMemo(
    () => (workouts || []).filter((w) => w.isCompleted),
    [workouts]
  );
  const [period, setPeriod] = useState<StatsPeriod>('7d');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('sessions');
  const [topSort, setTopSort] = useState<'sessions' | 'volume' | 'weight'>('sessions');
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(null);
  const [aiInsight, setAiInsight] = useState<AIInsightResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiRequestRef = useRef(0);

  const resetStatsFilters = useCallback(() => {
    setPeriod('7d');
    setCustomStart(null);
    setCustomEnd(null);
    setTrendMetric('sessions');
    setTopSort('sessions');
    setActivePicker(null);
  }, []);

  const todayOnly = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const formatShortDate = useCallback((d: string) => formatDateShort(d, lang), [lang]);
  const formatDate = (d: Date) => toISODate(d);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const raw = await storage.getItem(STATS_PREFS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<StatsScreenPrefs>;
        if (
          parsed.period === '7d' ||
          parsed.period === '30d' ||
          parsed.period === '90d' ||
          parsed.period === 'year' ||
          parsed.period === 'all' ||
          parsed.period === 'custom'
        ) {
          setPeriod(parsed.period);
        }
        if (
          parsed.trendMetric === 'sessions' ||
          parsed.trendMetric === 'minutes' ||
          parsed.trendMetric === 'volume'
        ) {
          setTrendMetric(parsed.trendMetric);
        }
        if (
          parsed.topSort === 'sessions' ||
          parsed.topSort === 'volume' ||
          parsed.topSort === 'weight'
        ) {
          setTopSort(parsed.topSort);
        }
        if (typeof parsed.customStart === 'string') {
          const d = parseISODate(parsed.customStart);
          if (d) setCustomStart(d);
        }
        if (typeof parsed.customEnd === 'string') {
          const d = parseISODate(parsed.customEnd);
          if (d) setCustomEnd(d);
        }
      } catch {
        // ignore invalid persisted prefs
      } finally {
        setPrefsHydrated(true);
      }
    };
    loadPrefs();
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    const payload: StatsScreenPrefs = {
      period,
      trendMetric,
      topSort,
      customStart: customStart ? toISODate(customStart) : null,
      customEnd: customEnd ? toISODate(customEnd) : null,
    };
    storage.setItem(STATS_PREFS_KEY, JSON.stringify(payload)).catch(() => {});
  }, [prefsHydrated, period, trendMetric, topSort, customStart, customEnd]);
  // Periodfiltrering
  const periodFiltered = useMemo(() => {
    if (period === 'all') return completedWorkouts;
    if (period === 'custom') {
      if (!customStart && !customEnd) return [];
      const rawStart = customStart || customEnd!;
      const rawEnd = customEnd || customStart!;
      const start = rawStart <= rawEnd ? startOfDay(rawStart) : startOfDay(rawEnd);
      const end = rawEnd >= rawStart ? startOfDay(rawEnd) : startOfDay(rawStart);
      return completedWorkouts.filter((w) => {
        const d = parseISODate(w.date);
        if (!d) return false;
        return d >= start && d <= end;
      });
    }
    const days = getPeriodDays(period);
    if (!days) return completedWorkouts;
    const cutoff = new Date(todayOnly);
    cutoff.setDate(cutoff.getDate() - days + 1);
    return completedWorkouts.filter((w) => {
      const d = parseISODate(w.date);
      if (!d) return false;
      return d >= cutoff && d <= todayOnly;
    });
  }, [period, todayOnly, completedWorkouts, customStart, customEnd]);

  const periodRangeLabel = useMemo(() => {
    if (period !== 'custom') return '';
    if (!customStart && !customEnd) return t('stats.customRangeNotSet');
    const rawStart = customStart || customEnd!;
    const rawEnd = customEnd || customStart!;
    const orderedStart = rawStart <= rawEnd ? rawStart : rawEnd;
    const orderedEnd = rawEnd >= rawStart ? rawEnd : rawStart;
    const startText = formatShortDate(toISODate(orderedStart));
    const endText = formatShortDate(toISODate(orderedEnd));
    return t('stats.customRangeLabel', undefined, { start: startText, end: endText });
  }, [period, customStart, customEnd, t, formatShortDate]);

  const customMarkedDates = useMemo(() => {
    if (!customStart && !customEnd) return {};
    const start = customStart || customEnd!;
    const end = customEnd || customStart!;
    const orderedStart = start <= end ? start : end;
    const orderedEnd = end >= start ? end : start;
    const startIso = toISODate(orderedStart);
    const endIso = toISODate(orderedEnd);

    const marks: Record<
      string,
      {
        startingDay: boolean;
        endingDay: boolean;
        color: string;
        textColor: string;
      }
    > = {};
    if (startIso === endIso) {
      marks[startIso] = {
        startingDay: true,
        endingDay: true,
        color: colors.primary,
        textColor: colors.background,
      };
      return marks;
    }

    let cursor = new Date(orderedStart);
    while (cursor <= orderedEnd) {
      const iso = toISODate(cursor);
      const isStart = iso === startIso;
      const isEnd = iso === endIso;
      marks[iso] = {
        color: colors.primary,
        textColor: colors.background,
        startingDay: isStart,
        endingDay: isEnd,
      };
      cursor.setDate(cursor.getDate() + 1);
    }
    return marks;
  }, [customStart, customEnd]);

  const customSelectionHint = useMemo(() => {
    if (period !== 'custom') return '';
    return activePicker === 'end' ? t('stats.pickEnd') : t('stats.pickStart');
  }, [activePicker, period, t]);

  const handleCustomDatePick = useCallback(
    (day: CalendarDay) => {
      const picked = parseISODate(day.dateString);
      if (!picked) return;
      if (activePicker === 'end' && customStart) {
        const orderedStart = picked < customStart ? picked : customStart;
        const orderedEnd = picked < customStart ? customStart : picked;
        setCustomStart(orderedStart);
        setCustomEnd(orderedEnd);
        setActivePicker('start');
      } else {
        // Starta alltid en ny intervall-selektion med startdatum först.
        setCustomStart(picked);
        setCustomEnd(null);
        setActivePicker('end');
      }
      setPeriod('custom');
    },
    [activePicker, customStart]
  );

  const periodSummary = useMemo(() => {
    const totalMinutes = periodFiltered.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
    const activeDays = new Set(periodFiltered.map((w) => w.date)).size;
    const totalVolume = periodFiltered.reduce((sum, w) => sum + workoutVolume(w), 0);
    const avgMinutes = periodFiltered.length > 0 ? Math.round(totalMinutes / periodFiltered.length) : 0;
    return {
      sessions: periodFiltered.length,
      activeDays,
      totalMinutes,
      totalVolume: Math.round(totalVolume),
      avgMinutes,
    };
  }, [periodFiltered]);

  const previousSummary = useMemo(() => {
    const days = getPeriodDays(period);
    if (!days) return null;

    const prevEnd = new Date(todayOnly);
    prevEnd.setDate(prevEnd.getDate() - days);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);

    const previous = completedWorkouts.filter((w) => {
      const d = parseISODate(w.date);
      if (!d) return false;
      return d >= prevStart && d <= prevEnd;
    });

    const totalMinutes = previous.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
    const totalVolume = previous.reduce((sum, w) => sum + workoutVolume(w), 0);
    return {
      sessions: previous.length,
      totalVolume: Math.round(totalVolume),
      avgMinutes: previous.length > 0 ? Math.round(totalMinutes / previous.length) : 0,
    };
  }, [completedWorkouts, period, todayOnly]);

  const weeklyKpis = useMemo(() => {
    const currentWeekStart = startOfWeekDate(todayOnly);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);

    const inRange = (iso: string, start: Date, end: Date) => {
      const d = parseISODate(iso);
      if (!d) return false;
      return d >= start && d <= end;
    };

    const currentWeekWorkouts = completedWorkouts.filter((w) =>
      inRange(w.date, currentWeekStart, currentWeekEnd)
    );
    const previousWeekWorkouts = completedWorkouts.filter((w) =>
      inRange(w.date, previousWeekStart, previousWeekEnd)
    );

    const currentWeekMinutes = currentWeekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
    const previousWeekMinutes = previousWeekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
    const currentWeekVolume = Math.round(currentWeekWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0));
    const previousWeekVolume = Math.round(previousWeekWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0));

    const safeGoal = Number.isFinite(weeklyGoal) && weeklyGoal > 0 ? weeklyGoal : 0;
    const goalReached = safeGoal > 0 && currentWeekWorkouts.length >= safeGoal;

    return {
      sessions: currentWeekWorkouts.length,
      goal: safeGoal,
      goalReached,
      minutes: currentWeekMinutes,
      minutesDelta: currentWeekMinutes - previousWeekMinutes,
      volume: currentWeekVolume,
      volumeDelta: currentWeekVolume - previousWeekVolume,
    };
  }, [completedWorkouts, todayOnly, weeklyGoal]);

  const formatSignedDelta = useCallback((value: number, unit: 'min' | 'kg') => {
    const rounded = Math.round(value);
    return `${rounded >= 0 ? '+' : ''}${rounded} ${unit}`;
  }, []);

  const trendPoints = useMemo(() => {
    if (periodFiltered.length === 0) return [] as {
      key: string;
      label: string;
      sessions: number;
      minutes: number;
      volume: number;
    }[];

    if (period === '7d' || period === '30d') {
      const daysCount = period === '7d' ? 7 : 30;
      const latest = new Date(todayOnly);
      const days = Array.from({ length: daysCount }, (_, index) => {
        const d = new Date(latest);
        d.setDate(d.getDate() - (daysCount - 1 - index));
        const iso = toISODate(d);
        return {
          key: iso,
          label: formatShortDate(iso),
          sessions: 0,
          minutes: 0,
          volume: 0,
        };
      });

      const byDate = new Map(days.map((d) => [d.key, d]));
      periodFiltered.forEach((w) => {
        const entry = byDate.get(w.date);
        if (!entry) return;
        entry.sessions += 1;
        entry.minutes += w.durationMinutes || 0;
        entry.volume += workoutVolume(w);
      });
      return days;
    }

    if (period === 'year') {
      const months = Array.from({ length: 12 }, (_, index) => {
        const d = new Date(todayOnly.getFullYear(), todayOnly.getMonth() - (11 - index), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString(lang === 'sv' ? 'sv-SE' : 'en-US', { month: 'short' });
        return {
          key,
          label,
          year: d.getFullYear(),
          month: d.getMonth(),
          sessions: 0,
          minutes: 0,
          volume: 0,
        };
      });

      periodFiltered.forEach((w) => {
        const d = parseISODate(w.date);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const target = months.find((bucket) => bucket.key === key);
        if (!target) return;
        target.sessions += 1;
        target.minutes += w.durationMinutes || 0;
        target.volume += workoutVolume(w);
      });

      return months.map(({ year, month, ...rest }) => rest);
    }

    const weekCount = period === '90d' ? 13 : 6;
    const latestWeekStart = startOfWeekDate(todayOnly);
    const weeks = Array.from({ length: weekCount }, (_, index) => {
      const start = new Date(latestWeekStart);
      start.setDate(start.getDate() - (weekCount - 1 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        key: toISODate(start),
        label: formatShortDate(toISODate(start)),
        start,
        end,
        sessions: 0,
        minutes: 0,
        volume: 0,
      };
    });

    periodFiltered.forEach((w) => {
      const d = parseISODate(w.date);
      if (!d) return;
      const target = weeks.find((bucket) => d >= bucket.start && d <= bucket.end);
      if (!target) return;
      target.sessions += 1;
      target.minutes += w.durationMinutes || 0;
      target.volume += workoutVolume(w);
    });

    return weeks.map(({ start, end, ...rest }) => rest);
  }, [periodFiltered, period, todayOnly, formatShortDate, lang]);

  const trendMetrics = useMemo(
    () => [
      { key: 'sessions' as const, label: t('stats.trendSessions') },
      { key: 'minutes' as const, label: t('stats.trendMinutes') },
      { key: 'volume' as const, label: t('stats.trendVolume') },
    ],
    [t]
  );

  const trendGranularity =
    period === '7d' || period === '30d'
      ? 'day'
      : period === 'year'
        ? 'month'
        : 'week';

  const activeTrend = useMemo(() => {
    const values = trendPoints.map((point) => Number(point[trendMetric]));
    const max = Math.max(...values, 1);
    const latest = values.length > 0 ? values[values.length - 1] : 0;
    const previous = values.length > 1 ? values[values.length - 2] : 0;
    const total = values.reduce((sum, value) => sum + value, 0);
    const avg = values.length > 0 ? total / values.length : 0;
    return {
      max,
      latest,
      previous,
      avg,
      delta: latest - previous,
      wowPct:
        previous > 0
          ? ((latest - previous) / previous) * 100
          : latest > 0
            ? 100
            : 0,
    };
  }, [trendPoints, trendMetric]);

  useEffect(() => {
    if (trendPoints.length === 0) {
      setSelectedTrendIndex(null);
      return;
    }
    setSelectedTrendIndex((prev) => {
      if (prev == null || prev < 0 || prev >= trendPoints.length) return trendPoints.length - 1;
      return prev;
    });
  }, [trendPoints, trendMetric]);

  const selectedTrendPoint = useMemo(() => {
    if (trendPoints.length === 0) return null;
    const idx =
      selectedTrendIndex != null && selectedTrendIndex >= 0 && selectedTrendIndex < trendPoints.length
        ? selectedTrendIndex
        : trendPoints.length - 1;
    return { point: trendPoints[idx], index: idx };
  }, [trendPoints, selectedTrendIndex]);

  const selectedTrendDetails = useMemo(() => {
    if (!selectedTrendPoint) return null;
    const value = Number(selectedTrendPoint.point[trendMetric]);
    const prevValue =
      selectedTrendPoint.index > 0
        ? Number(trendPoints[selectedTrendPoint.index - 1][trendMetric])
        : value;
    return {
      label: selectedTrendPoint.point.label,
      value,
      delta: value - prevValue,
    };
  }, [selectedTrendPoint, trendMetric, trendPoints]);

  const trendLabelStride = useMemo(() => {
    const total = trendPoints.length;
    if (total <= 8) return 1;
    if (total <= 14) return 2;
    if (total <= 20) return 3;
    if (total <= 31) return 5;
    return 4;
  }, [trendPoints.length]);

  const trendDirection = useMemo(() => {
    if (activeTrend.delta > 0) {
      return {
        key: 'up' as const,
        label: t('stats.trendDirectionUp'),
        color: colors.accentGreen,
      };
    }
    if (activeTrend.delta < 0) {
      return {
        key: 'down' as const,
        label: t('stats.trendDirectionDown'),
        color: colors.accent,
      };
    }
    return {
      key: 'flat' as const,
      label: t('stats.trendDirectionFlat'),
      color: colors.textSoft,
    };
  }, [activeTrend.delta, t]);

  const topExercises = useMemo(() => {
    type TopEntry = {
      name: string;
      sessions: number;
      bestWeight: number;
      lastDate: string;
      lastCompleted: boolean;
      totalVolume: number;
      lastDelta?: number | null;
      totalSets: number;
      totalReps: number;
    };

    const map = new Map<string, TopEntry>();
    const sortedByDate = [...periodFiltered].sort((a, b) => compareISODate(a.date, b.date));
    sortedByDate.forEach((w) => {
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
            totalSets: 0,
            totalReps: 0,
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
        const previousBest = entry.bestWeight;
        entry.bestWeight = Math.max(entry.bestWeight, exerciseMax);
        entry.totalVolume += setVolume;
        entry.totalSets += ex.sets || sets.length || 0;
        entry.totalReps += sets.reduce((acc, s) => {
          const repsNum = parseRepsValue(String(s.reps));
          return acc + repsNum;
        }, 0);

        if (compareISODate(w.date, entry.lastDate) > 0) {
          entry.lastDelta =
            exerciseMax > 0 && previousBest > 0
              ? exerciseMax - previousBest
              : exerciseMax > 0 && previousBest === 0
                ? exerciseMax
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

  const aiPayload = useMemo<AIInsightRequest>(
    () => ({
      lang,
      todayISO: toISODate(todayOnly),
      period,
      weeklyGoal,
      summary: {
        sessions: periodSummary.sessions,
        activeDays: periodSummary.activeDays,
        totalMinutes: periodSummary.totalMinutes,
        totalVolume: periodSummary.totalVolume,
        avgMinutes: periodSummary.avgMinutes,
      },
      topExercises: topExercises.slice(0, 3).map((ex) => ({
        name: ex.name,
        sessions: ex.sessions,
        bestWeight: ex.bestWeight,
      })),
    }),
    [lang, todayOnly, period, weeklyGoal, periodSummary, topExercises]
  );

  const runAIInsight = useCallback(async (payload: AIInsightRequest) => {
    const requestId = aiRequestRef.current + 1;
    aiRequestRef.current = requestId;
    setAiLoading(true);
    const insight = await getAIInsight(payload);
    if (requestId !== aiRequestRef.current) return;
    setAiInsight(insight);
    setAiLoading(false);
  }, []);

  const loadAIInsight = useCallback(async () => {
    await runAIInsight(aiPayload);
  }, [aiPayload, runAIInsight]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      await runAIInsight(aiPayload);
    }, 280);
    return () => {
      clearTimeout(timer);
    };
  }, [aiPayload, runAIInsight]);

  const pbData = useMemo(() => {
    type PBEntry = {
      name: string;
      weight: number;
      date: string;
      isCompleted: boolean;
      prevBest: number;
    };
    const sortedWorkouts = [...periodFiltered].sort(
      (a, b) => compareISODate(a.date, b.date)
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

    const pbList = Array.from(map.values())
      .map((pb) => {
        const pbDate = parseISODate(pb.date);
        if (!pbDate) {
          return {
            ...pb,
            delta: pb.weight - (pb.prevBest ?? 0),
            isRecent: false,
            isPB: pb.weight > (pb.prevBest ?? 0) && pb.weight > 0,
          };
        }
        const diffDays =
          (todayOnly.getTime() - pbDate.getTime()) / (1000 * 60 * 60 * 24);
        const delta = pb.weight - (pb.prevBest ?? 0);
        const isPB = pb.weight > (pb.prevBest ?? 0) && pb.weight > 0;
        return {
          ...pb,
          delta: isPB ? delta : null,
          isRecent: diffDays <= 30,
          isPB,
        };
      })
      // Visa bara riktiga PB (måste slå ett tidigare värde eller första registrering >0)
      .filter((pb) => pb.isPB);

    const featured = pbList
      .sort((a, b) => {
        if (b.weight === a.weight) {
          return compareISODate(b.date, a.date);
        }
        return b.weight - a.weight;
      })
      .slice(0, 3);

    const latestDate =
      pbList.length > 0
        ? [...pbList].sort((a, b) => compareISODate(b.date, a.date))[0].date
        : null;
    const biggestDelta = Math.max(
      ...pbList.map((pb) => (pb.delta != null ? pb.delta : 0)),
      0
    );

    return {
      featured,
      total: pbList.length,
      latestDate,
      biggestDelta,
    };
  }, [periodFiltered, todayOnly]);

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
        <StaggerReveal delay={40}>
          <ScreenHeader title={t('stats.title')} subtitle={t('stats.subtitle')} tone="violet" />
        </StaggerReveal>

        <StaggerReveal delay={80}>
          <GlassCard style={styles.filterPanel} elevated={false} tone="violet">
          <View style={styles.filterRow}>
            {(['7d', '30d', '90d', 'year', 'all', 'custom'] as const).map((p) => {
              const active = period === p;
              return (
                <BadgePill
                  key={p}
                  label={t(`stats.filters.${p}`)}
                  tone={active ? 'primary' : 'neutral'}
                  style={active ? { ...styles.filterChip, ...styles.filterChipActive } : styles.filterChip}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPeriod(p);
                    if (p === 'custom') {
                      setActivePicker('start');
                    }
                  }}
                />
              );
            })}
          </View>
          {period === 'custom' ? (
            <View style={styles.customInlineWrap}>
              <Text style={styles.customRangeText}>{periodRangeLabel}</Text>
              <Text style={styles.customInlineHint}>
                {t('stats.datePickerTapHint')} {customSelectionHint}
              </Text>
              <View style={styles.customStepRow}>
                <TouchableOpacity
                  style={[
                    styles.customStepButton,
                    activePicker === 'start' && styles.customStepButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker('start');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.pickStart')}
                >
                  <Text
                    style={[
                      styles.customStepText,
                      activePicker === 'start' && styles.customStepTextActive,
                    ]}
                  >
                    {t('stats.startLabel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.customStepButton,
                    activePicker === 'end' && styles.customStepButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker('end');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.pickEnd')}
                >
                  <Text
                    style={[
                      styles.customStepText,
                      activePicker === 'end' && styles.customStepTextActive,
                    ]}
                  >
                    {t('stats.endLabel')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.customDateRow}>
                <TouchableOpacity
                  style={[
                    styles.customDateBox,
                    activePicker === 'start' && styles.customDateBoxActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker('start');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.pickStart')}
                >
                  <Text
                    style={[
                      styles.customDateLabel,
                      activePicker === 'start' && styles.customDateLabelActive,
                    ]}
                  >
                    {t('stats.startLabel')}
                  </Text>
                  <Text style={styles.customDateValue}>
                    {customStart ? formatDate(customStart) : t('stats.startPlaceholder')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.customDateBox,
                    activePicker === 'end' && styles.customDateBoxActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePicker('end');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.pickEnd')}
                >
                  <Text
                    style={[
                      styles.customDateLabel,
                      activePicker === 'end' && styles.customDateLabelActive,
                    ]}
                  >
                    {t('stats.endLabel')}
                  </Text>
                  <Text style={styles.customDateValue}>
                    {customEnd ? formatDate(customEnd) : t('stats.endPlaceholder')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.customInlineCalendar}>
                <Calendar
                  current={formatDate(customStart || customEnd || todayOnly)}
                  markingType="period"
                  onDayPress={handleCustomDatePick}
                  markedDates={customMarkedDates}
                  theme={{
                    backgroundColor: colors.backgroundSoft,
                    calendarBackground: colors.backgroundSoft,
                    monthTextColor: colors.textMain,
                    dayTextColor: colors.textMain,
                    textDisabledColor: colors.textSoft,
                    arrowColor: colors.textMain,
                  }}
                />
              </View>
            </View>
          ) : null}
          <View style={styles.filterActionsRow}>
            <TouchableOpacity
              style={styles.filterResetButton}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.selectionAsync();
                resetStatsFilters();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('stats.resetFilters')}
            >
              <Text style={styles.filterResetText}>{t('stats.resetFilters')}</Text>
            </TouchableOpacity>
          </View>
          </GlassCard>
        </StaggerReveal>
      {periodFiltered.length === 0 ? (
        <StaggerReveal delay={120}>
          <GlassCard style={styles.card} elevated={false} tone="violet">
          <Text style={styles.cardTitle}>{t('stats.periodEmptyTitle')}</Text>
          <Text style={styles.cardText}>{t('stats.periodEmptySubtitle')}</Text>
          <View style={styles.progressButtons}>
            <TouchableOpacity
              style={[styles.pbEmptyButton, styles.primaryButton]}
              onPress={() => {
                Haptics.selectionAsync();
                setPeriod('all');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('stats.periodEmptyAllBtn')}
            >
              <Text style={styles.pbEmptyButtonText}>{t('stats.periodEmptyAllBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pbEmptyButton, styles.secondaryButton]}
              onPress={() => {
                Haptics.selectionAsync();
                setPeriod('custom');
                setActivePicker('start');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('stats.periodEmptyCustomBtn')}
            >
              <Text style={styles.pbEmptyButtonText}>{t('stats.periodEmptyCustomBtn')}</Text>
            </TouchableOpacity>
          </View>
          </GlassCard>
        </StaggerReveal>
      ) : null}

      {period === '7d' ? (
        <StaggerReveal delay={160}>
          <GlassCard style={styles.card} elevated={false} tone="teal">
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Sparkles size={18} color={colors.accentBlue} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('stats.weeklyKpiTitle')}</Text>
                <Text style={styles.cardText}>{t('stats.weeklyKpiSubtitle')}</Text>
              </View>
            </View>
          </View>
          <View style={styles.weeklyKpiRow}>
            <View style={styles.weeklyKpiItem}>
              <Text style={styles.statLabel}>{t('stats.weeklyKpiGoal')}</Text>
              <Text style={styles.statValue}>
                {weeklyKpis.goal > 0
                  ? `${weeklyKpis.sessions}/${weeklyKpis.goal}`
                  : `${weeklyKpis.sessions}`}
              </Text>
              <Text style={styles.progressLabel}>
                {weeklyKpis.goal > 0
                  ? weeklyKpis.goalReached
                    ? t('stats.weeklyKpiGoalReached')
                    : t('stats.weeklyKpiGoalLeft', undefined, {
                        count: Math.max(weeklyKpis.goal - weeklyKpis.sessions, 0),
                      })
                  : t('stats.weeklyKpiNoGoal')}
              </Text>
            </View>
            <View style={styles.weeklyKpiItem}>
              <Text style={styles.statLabel}>{t('stats.weeklyKpiVolume')}</Text>
              <Text style={styles.statValue}>{weeklyKpis.volume}</Text>
              <Text style={styles.progressLabel}>
                {t('stats.weeklyKpiVsLast', undefined, formatSignedDelta(weeklyKpis.volumeDelta, 'kg'))}
              </Text>
            </View>
            <View style={styles.weeklyKpiItem}>
              <Text style={styles.statLabel}>{t('stats.weeklyKpiMinutes')}</Text>
              <Text style={styles.statValue}>{weeklyKpis.minutes}</Text>
              <Text style={styles.progressLabel}>
                {t('stats.weeklyKpiVsLast', undefined, formatSignedDelta(weeklyKpis.minutesDelta, 'min'))}
              </Text>
            </View>
          </View>
          </GlassCard>
        </StaggerReveal>
      ) : null}

      <StaggerReveal delay={200}>
        <GlassCard style={styles.card} elevated={false} tone="blue">
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircle}>
              <Clock size={18} color={colors.accentBlue} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{t('stats.periodSnapshotTitle')}</Text>
              <Text style={styles.cardText}>
                {t('stats.periodSnapshotSubtitle', undefined, t(`stats.filters.${period}`))}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.statLabel}>{t('stats.periodSessions')}</Text>
            <Text style={styles.statValue}>{periodSummary.sessions}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.statLabel}>{t('stats.periodActiveDays')}</Text>
            <Text style={styles.statValue}>{periodSummary.activeDays}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.statLabel}>{t('stats.periodMinutes')}</Text>
            <Text style={styles.statValue}>{periodSummary.totalMinutes}</Text>
          </View>
        </View>
        <View style={styles.monthRow}>
          <View style={styles.monthItem}>
            <Text style={styles.statLabel}>{t('stats.periodVolume')}</Text>
            <Text style={styles.statValue}>{periodSummary.totalVolume}</Text>
          </View>
          <View style={styles.monthItem}>
            <Text style={styles.statLabel}>{t('stats.periodAvgMinutes')}</Text>
            <Text style={styles.statValue}>{periodSummary.avgMinutes}</Text>
          </View>
        </View>
        <Text style={styles.progressLabel}>
          {previousSummary
            ? t('stats.periodDeltaSummary', undefined, {
                sessions: periodSummary.sessions - previousSummary.sessions,
                volume: periodSummary.totalVolume - previousSummary.totalVolume,
                avgMinutes: periodSummary.avgMinutes - previousSummary.avgMinutes,
              })
            : t('stats.periodDeltaUnavailable')}
        </Text>
        </GlassCard>
      </StaggerReveal>

      {/* AI INSIGHTS */}
      <StaggerReveal delay={240}>
        <GlassCard style={styles.card} elevated={false} tone="violet">
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircle}>
              <Sparkles size={18} color={colors.primaryBright} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{t('stats.aiTitle')}</Text>
              <Text style={styles.cardText}>{t('stats.aiSubtitle')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.aiRefreshButton}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.selectionAsync();
              loadAIInsight();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('stats.aiRefresh')}
          >
            <Text style={styles.aiRefreshText}>{t('stats.aiRefresh')}</Text>
          </TouchableOpacity>
        </View>

        {aiLoading ? (
          <Text style={styles.cardText}>{t('stats.aiLoading')}</Text>
        ) : aiInsight ? (
          <View style={styles.aiContent}>
            <Text style={styles.aiSummaryText}>{aiInsight.summary}</Text>
            <Text style={styles.statLabel}>{t('stats.aiActionsTitle')}</Text>
            {aiInsight.actions.map((action, idx) => (
              <Text key={`${action}-${idx}`} style={styles.aiActionText}>
                {idx + 1}. {action}
              </Text>
            ))}
            <Text style={styles.aiNextStepText}>{aiInsight.nextStep}</Text>
            {aiInsight.source === 'fallback' ? (
              <Text style={styles.aiSourceText}>{t('stats.aiSourceFallback')}</Text>
            ) : null}
          </View>
        ) : null}
        </GlassCard>
      </StaggerReveal>

      {/* TRENDS */}
      <StaggerReveal delay={280}>
        <GlassCard style={styles.card} elevated={false} tone="teal">
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.iconCircle}>
              <BarChart3 size={18} color={colors.accentBlue} />
            </View>
            <View>
              <Text style={styles.cardTitle}>{t('stats.trendTitle')}</Text>
              <Text style={styles.cardText}>{t('stats.trendSubtitle')}</Text>
            </View>
          </View>
        </View>
        {trendPoints.length === 0 ? (
          <Text style={styles.emptyText}>{t('stats.trendEmpty')}</Text>
        ) : (
          <View style={styles.trendMetrics}>
            <View style={styles.trendMetricPicker}>
              {trendMetrics.map((metric) => {
                const active = trendMetric === metric.key;
                return (
                  <TouchableOpacity
                    key={metric.key}
                    style={[styles.trendMetricChip, active ? styles.trendMetricChipActive : null]}
                    activeOpacity={0.85}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTrendMetric(metric.key);
                    }}
                  >
                    <Text style={[styles.trendMetricChipText, active ? styles.trendMetricChipTextActive : null]}>
                      {metric.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.trendMetricBlock}>
              <Text style={styles.statLabel}>
                {trendMetrics.find((metric) => metric.key === trendMetric)?.label}
              </Text>
              <Text style={styles.trendContextText}>
                {t(
                  'stats.trendGranularity',
                  undefined,
                  trendGranularity === 'day'
                    ? t('stats.trendGranularityDay')
                    : trendGranularity === 'month'
                      ? t('stats.trendGranularityMonth')
                      : t('stats.trendGranularityWeek')
                )}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trendBars}
              >
                {trendPoints.map((point, index) => {
                  const rawValue = Number(point[trendMetric]);
                  const heightPercent = Math.max(0.1, rawValue / activeTrend.max);
                  const prevValue = index > 0 ? Number(trendPoints[index - 1][trendMetric]) : rawValue;
                  const barColor =
                    rawValue > prevValue
                      ? colors.accentGreen
                      : rawValue < prevValue
                        ? colors.accent
                        : colors.primary;
                  const isSelected = selectedTrendPoint?.point.key === point.key;
                  return (
                    <TouchableOpacity
                      key={`${trendMetric}-${point.key}`}
                      style={[styles.trendBarCol, trendPoints.length > 14 ? styles.trendBarColDense : null]}
                      activeOpacity={0.85}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedTrendIndex(index);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('stats.trendPointA11y', undefined, {
                        label: point.label,
                        value: formatTrendMetricValue(rawValue, trendMetric, t),
                      })}
                    >
                      <View style={[styles.trendBarBg, styles.trendBarBgLarge, isSelected ? styles.trendBarBgSelected : null]}>
                        <View
                          style={[
                            styles.trendBarFill,
                            { backgroundColor: barColor },
                            { height: `${Math.round(heightPercent * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.trendBarLabel, isSelected ? styles.trendBarLabelSelected : null]}
                      >
                        {index === 0 ||
                        index === trendPoints.length - 1 ||
                        isSelected ||
                        index % trendLabelStride === 0
                          ? point.label
                          : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.trendHintText}>{t('stats.trendTapHint')}</Text>
            </View>

            {selectedTrendDetails ? (
              <View style={styles.trendSelectedCard}>
                <Text style={styles.statLabel}>
                  {t('stats.trendSelectedPoint', undefined, selectedTrendDetails.label)}
                </Text>
                <Text style={styles.trendSelectedValue}>
                  {formatTrendMetricValue(selectedTrendDetails.value, trendMetric, t)}
                </Text>
                <Text style={styles.progressLabel}>
                  {t('stats.trendPointDeltaStat', undefined, {
                    value: Math.round(selectedTrendDetails.delta),
                  })}
                </Text>
              </View>
            ) : null}

            <View style={styles.trendSummaryRow}>
              <View style={styles.trendSummaryItem}>
                <Text style={styles.statLabel}>{t('stats.trendLatestStat')}</Text>
                <Text style={styles.statValue}>{Math.round(activeTrend.latest)}</Text>
              </View>
              <View style={styles.trendSummaryItem}>
                <Text style={styles.statLabel}>{t('stats.trendAverageStat')}</Text>
                <Text style={styles.statValue}>{activeTrend.avg.toFixed(1)}</Text>
              </View>
              <View style={styles.trendSummaryItem}>
                <Text style={styles.statLabel}>{t('stats.trendPeakStat')}</Text>
                <Text style={styles.statValue}>{Math.round(activeTrend.max)}</Text>
              </View>
            </View>
            <View style={styles.trendDeltaRow}>
              <View style={[styles.trendDirectionPill, { borderColor: trendDirection.color }]}>
                {trendDirection.key === 'up' ? (
                  <TrendingUp size={12} color={trendDirection.color} />
                ) : trendDirection.key === 'down' ? (
                  <TrendingDown size={12} color={trendDirection.color} />
                ) : (
                  <Minus size={12} color={trendDirection.color} />
                )}
                <Text style={[styles.trendDirectionText, { color: trendDirection.color }]}>
                  {trendDirection.label}
                </Text>
              </View>
              <Text style={styles.progressLabel}>
                {t('stats.trendDeltaStat', undefined, { value: Math.round(activeTrend.delta) })}
              </Text>
            </View>
            <Text style={styles.progressLabel}>
              {t('stats.trendWoWStat', undefined, { value: activeTrend.wowPct.toFixed(1) })}
            </Text>
          </View>
        )}
        </GlassCard>
      </StaggerReveal>

        {/* PB */}
        <StaggerReveal delay={320}>
          <GlassCard style={styles.card} elevated={false} tone="amber">
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Trophy size={18} color={colors.warning} />
              </View>
              <View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/pb-list');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.pbTitle')}
                >
                  <Text style={styles.cardTitle}>{t('stats.pbTitle')}</Text>
                  <Text style={styles.cardText}>
                    {t('stats.pbSubtitle')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.statLabel}>{t('stats.pbActive')}</Text>
              <Text style={styles.statValue}>{pbData.total}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.statLabel}>{t('stats.pbLatest')}</Text>
              <Text style={styles.statValue}>
                {pbData.latestDate ? formatShortDate(pbData.latestDate) : '–'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.statLabel}>{t('stats.pbTotalImprovement')}</Text>
              <Text style={styles.statValue}>
                {pbData.biggestDelta > 0 ? `+${pbData.biggestDelta}` : '0'} kg
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.pbEmptyButton, styles.primaryButton, styles.pbOpenAllButton]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/pb-list');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('stats.pbOpenAll')}
          >
            <Text style={styles.pbEmptyButtonText}>{t('stats.pbOpenAll')}</Text>
          </TouchableOpacity>
          <Text style={styles.progressLabel}>{t('stats.pbHistoryHint')}</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>{t('stats.sortName')}</Text>
            <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>{t('stats.sortDate')}</Text>
            <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>{t('stats.sortValue')}</Text>
          </View>

          {pbData.featured.length === 0 ? (
            completedWorkouts.length === 0 ? (
              <View style={styles.pbEmpty}>
                <Text style={styles.emptyText}>
                  {t('stats.pbEmptyFirst')}
                </Text>
                <View style={styles.pbEmptyActions}>
                  <TouchableOpacity
                    style={[styles.pbEmptyButton, styles.primaryButton]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/workout/quick-workout');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.start')}
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
                    accessibilityLabel={t('home.weekEmptyCTA')}
                  >
                    <Text style={styles.pbEmptyButtonText}>{t('home.weekEmptyCTA')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {t('stats.pbEmpty')}
              </Text>
            )
          ) : (
            pbData.featured.map((pb) => (
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
                accessibilityLabel={t('stats.viewExercisesFor', undefined, pb.name)}
              >
                <Text style={[styles.pbName, { flex: 1.2 }]}>{pb.name}</Text>
                <Text style={[styles.pbDate, { flex: 1, textAlign: 'center' }]}>{formatShortDate(pb.date)}</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.pbWeight}>{pb.weight} kg</Text>
                  {pb.delta != null ? <Text style={styles.pbDelta}>{t('stats.pbDelta', undefined, pb.delta)}</Text> : null}
                </View>
              </TouchableOpacity>
            ))
          )}
          </GlassCard>
        </StaggerReveal>

        {/* ÖVNINGS-PROGRESS LINK */}
        <StaggerReveal delay={360}>
          <GlassCard style={styles.card} elevated={false} tone="green">
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <Dumbbell size={18} color={colors.accentBlue} />
              </View>
              <View>
                <Text style={styles.cardTitle}>{t('stats.progressTitle')}</Text>
                <Text style={styles.cardText}>
                  {t('stats.progressSubtitle')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressInfoRow}>
            <Text style={styles.progressInfoText}>
              {t('stats.topTitle')}
            </Text>
            <Text style={styles.progressInfoSub}>{t('stats.topSubtitle')}</Text>
          </View>

          <View style={styles.topSortRow}>
            {([
              { key: 'sessions', label: t('stats.topSortSessions') },
              { key: 'volume', label: t('stats.topSortVolume') },
              { key: 'weight', label: t('stats.topSortWeight') },
            ] as const).map((item) => {
              const active = topSort === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.topSortChip, active ? styles.topSortChipActive : null]}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTopSort(item.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text style={[styles.topSortText, active ? styles.topSortTextActive : null]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1.3 }]}>{t('stats.sortName')}</Text>
            <Text style={styles.tableHeaderText}>{t('stats.topSortSessions')}</Text>
            <Text style={[styles.tableHeaderText, { textAlign: 'right' }]}>{t('stats.sortValue')}</Text>
          </View>

          {topExercises.length === 0 ? (
            <Text style={styles.emptyText}>{t('stats.topEmpty')}</Text>
          ) : (
            <View style={styles.topList}>
              {topExercises.slice(0, 5).map((ex) => (
                <TouchableOpacity
                  key={ex.name}
                  style={styles.topExerciseRow}
                  activeOpacity={0.9}
                  onPress={() =>
                    router.push({
                      pathname: '/exercise-progress/[name]',
                      params: { name: ex.name },
                    })
                  }
                >
                  <View style={{ flex: 1.3 }}>
                    <Text style={styles.topExerciseName}>{ex.name}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topExerciseMeta}>{ex.sessions}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.topExerciseMeta, { textAlign: 'right' }]}>
                      {ex.bestWeight > 0 ? `${ex.bestWeight} kg` : '–'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.pbEmptyButton, styles.primaryButton, styles.progressFreqButton]}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/exercise-progress');
            }}
            accessibilityLabel={t('stats.progressShowAll')}
            accessibilityRole="button"
          >
            <Text style={styles.pbEmptyButtonText}>{t('stats.progressShowAll')}</Text>
          </TouchableOpacity>
          </GlassCard>
        </StaggerReveal>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

type CalendarDay = { dateString: string };
const STATS_PREFS_KEY = 'stats-screen-prefs-v1';
type StatsScreenPrefs = {
  period: StatsPeriod;
  trendMetric: TrendMetric;
  topSort: 'sessions' | 'volume' | 'weight';
  customStart: string | null;
  customEnd: string | null;
};

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
    paddingHorizontal: spacing.lg + 2,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: spacing.xs + 1,
    marginBottom: spacing.md,
  },
  card: {
    marginTop: layout.sectionGapLg,
    borderRadius: 18,
  },
  filterPanel: {
    borderRadius: 16,
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
    borderColor: colors.cardBorder,
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
  aiRefreshButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  aiRefreshText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  aiContent: {
    marginTop: 2,
    gap: 4,
  },
  aiSummaryText: {
    ...typography.body,
    color: colors.textMain,
  },
  aiActionText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  aiNextStepText: {
    ...typography.bodyBold,
    color: colors.accentGreen,
    marginTop: 2,
  },
  aiSourceText: {
    ...typography.micro,
    color: colors.textMuted,
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
    borderColor: colors.cardBorder,
  },
  statLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  statValue: {
    ...typography.title,
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
    borderColor: colors.cardBorder,
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
    borderColor: colors.cardBorder,
  },
  weeklyKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  weeklyKpiItem: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    borderColor: colors.cardBorder,
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
    color: colors.background,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  customInlineWrap: {
    marginTop: 2,
    marginBottom: 8,
  },
  customRangeText: {
    ...typography.micro,
    color: colors.primaryBright,
    marginTop: 0,
    marginBottom: 4,
  },
  customInlineHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 8,
  },
  customStepRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  customStepButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customStepButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  customStepText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  customStepTextActive: {
    color: colors.textMain,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  customDateBox: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customDateBoxActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  customDateLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  customDateLabelActive: {
    color: colors.textMain,
  },
  customDateValue: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
    marginTop: 2,
  },
  customInlineCalendar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
    padding: 6,
  },
  filterActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 0,
  },
  filterResetButton: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  filterResetText: {
    ...typography.micro,
    color: colors.textMain,
    fontWeight: '700',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    minWidth: 70,
    alignItems: 'center',
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterText: {
    ...typography.caption,
    color: colors.textSoft,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.textMain,
  },
  pbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
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
    color: colors.textMuted,
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
    borderColor: colors.cardBorder,
  },
  pbEmptyButtonText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  pbOpenAllButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flex: 0,
    paddingHorizontal: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryBright,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
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
  progressButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  progressFreqButton: {
    marginTop: 8,
  },
  topSortRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 2,
  },
  tableHeader: {
    marginTop: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableHeaderText: {
    ...typography.micro,
    flex: 1,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  trendMetrics: {
    marginTop: 8,
    gap: 10,
  },
  trendMetricPicker: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  trendMetricChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  trendMetricChipActive: {
    borderColor: colors.primaryBright,
    backgroundColor: colors.primarySoft,
  },
  trendMetricChipText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  trendMetricChipTextActive: {
    color: colors.textMain,
  },
  trendMetricBlock: {
    gap: 6,
  },
  trendContextText: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: -2,
  },
  trendBars: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  trendBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 26,
  },
  trendBarColDense: {
    flex: 0,
    width: 20,
    minWidth: 20,
  },
  trendBarBg: {
    width: '100%',
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  trendBarBgLarge: {
    height: 84,
  },
  trendBarBgSelected: {
    borderColor: colors.primary,
  },
  trendBarFill: {
    width: '100%',
    backgroundColor: colors.primary,
  },
  trendBarLabel: {
    ...typography.micro,
    color: colors.textMuted,
    fontSize: 9,
  },
  trendBarLabelSelected: {
    color: colors.textMain,
    fontWeight: '700',
  },
  trendHintText: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
  trendSelectedCard: {
    marginTop: 2,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  trendSelectedValue: {
    ...typography.title,
    color: colors.textMain,
  },
  trendSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  trendSummaryItem: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  trendDeltaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendDirectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.button,
    borderWidth: 1,
    backgroundColor: colors.backgroundSoft,
  },
  trendDirectionText: {
    ...typography.micro,
    fontWeight: '700',
  },
  topSortChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  topSortChipActive: {
    borderColor: colors.primaryBright,
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
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  topList: {
    marginTop: 10,
  },
  topExerciseName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  topExerciseMeta: {
    ...typography.caption,
    color: colors.textSoft,
  },
  topExerciseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  topTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  topTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundSoft,
  },
  topTagText: {
    ...typography.micro,
    color: colors.textSoft,
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
  muscleSub: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
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
  muscleTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tagText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  muscleBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
});
