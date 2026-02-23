// app/training-frequency.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../components/ui/GlassCard';
import ScreenHeader from '../components/ui/ScreenHeader';
import { colors, gradients, typography } from '../constants/theme';
import { useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';
import { toISODate } from '../utils/date';
import { parseRepsValue } from '../utils/reps';

type PeriodKey = '7d' | '30d' | '90d' | 'all';

export default function TrainingFrequencyScreen() {
  const { workouts } = useWorkouts();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ exercise?: string }>();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [selected, setSelected] = useState<string | null>(
    typeof params.exercise === 'string' ? params.exercise : null
  );
  const [topSort, setTopSort] = useState<'sessions' | 'sets' | 'reps' | 'volume'>('sessions');

  React.useEffect(() => {
    if (typeof params.exercise === 'string') {
      setSelected(params.exercise);
    } else {
      setSelected(null);
    }
  }, [params.exercise]);

  const cutoff = useMemo(() => {
    if (period === 'all') return null;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toISODate(d);
  }, [period]);

  const completed = useMemo(
    () =>
      workouts.filter((w) => w.isCompleted).filter((w) => {
        if (!cutoff) return true;
        return w.date >= cutoff;
      }),
    [workouts, cutoff]
  );

  const filtered = useMemo(() => {
    return completed.flatMap((w) =>
      (w.exercises || [])
        .filter((ex) => ex.name && (!selected || ex.name === selected))
        .map((ex) => {
          const performed = ex.performedSets && ex.performedSets.length > 0 ? ex.performedSets : [];
          const setCount = ex.sets || performed.length || 0;
          const repTotal =
            performed.length > 0
              ? performed.reduce((acc, s) => acc + parseRepsValue(String(s.reps)), 0)
              : 0;
          const volume =
            performed.length > 0
              ? performed.reduce((acc, s) => {
                  const repsNum = parseRepsValue(String(s.reps));
                  const wt = Number(s.weight) || 0;
                  return acc + repsNum * wt;
                }, 0)
              : 0;
          const maxWeight =
            performed.length > 0
              ? performed.reduce((m, s) => Math.max(m, Number(s.weight) || 0), 0)
              : Number(ex.weight) || 0;
          return {
            workoutDate: w.date,
            exercise: ex.name!,
            sets: setCount,
            reps: repTotal,
            volume,
            maxWeight,
          };
        })
    );
  }, [completed, selected]);

  const summary = useMemo(() => {
    if (filtered.length === 0) {
      return {
        sessions: 0,
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
        avgSets: 0,
        avgReps: 0,
        avgVolume: 0,
      };
    }
    const sessions = filtered.length;
    const totalSets = filtered.reduce((s, r) => s + r.sets, 0);
    const totalReps = filtered.reduce((s, r) => s + r.reps, 0);
    const totalVolume = filtered.reduce((s, r) => s + r.volume, 0);
    return {
      sessions,
      totalSets,
      totalReps,
      totalVolume,
      avgSets: Math.round((totalSets / sessions) * 10) / 10,
      avgReps: Math.round((totalReps / sessions) * 10) / 10,
      avgVolume: Math.round((totalVolume / sessions) * 10) / 10,
    };
  }, [filtered]);

  const grouped = useMemo(() => {
    const buckets: Record<string, { sessions: number; sets: number; reps: number; volume: number }> = {};
    filtered.forEach((r) => {
      // group by month
      const key = r.workoutDate.slice(0, 7);
      if (!buckets[key]) buckets[key] = { sessions: 0, sets: 0, reps: 0, volume: 0 };
      buckets[key].sessions += 1;
      buckets[key].sets += r.sets;
      buckets[key].reps += r.reps;
      buckets[key].volume += r.volume;
    });
    return Object.entries(buckets)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [filtered]);

  const topExercises = useMemo(() => {
    const map = new Map<
      string,
      { name: string; sessions: number; sets: number; reps: number; volume: number }
    >();
    completed.forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (!ex.name) return;
        const performed = ex.performedSets || [];
        const sets = ex.sets || performed.length || 0;
        const reps =
          performed.length > 0
            ? performed.reduce((acc, s) => acc + parseRepsValue(String(s.reps)), 0)
            : 0;
        const volume =
          performed.length > 0
            ? performed.reduce((acc, s) => {
                const repsNum = parseRepsValue(String(s.reps));
                const wt = Number(s.weight) || 0;
                return acc + repsNum * wt;
              }, 0)
            : 0;
        if (!map.has(ex.name)) {
          map.set(ex.name, { name: ex.name, sessions: 0, sets: 0, reps: 0, volume: 0 });
        }
        const entry = map.get(ex.name)!;
        entry.sessions += 1;
        entry.sets += sets;
        entry.reps += reps;
        entry.volume += volume;
      });
    });
    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (topSort === 'sessions') return b.sessions - a.sessions;
      if (topSort === 'sets') return b.sets - a.sets;
      if (topSort === 'reps') return b.reps - a.reps;
      return b.volume - a.volume;
    });
    return list.slice(0, 6);
  }, [completed, topSort]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBlock}>
          <View style={styles.backRow}>
            <BackPill onPress={() => router.back()} />
          </View>
          <ScreenHeader
            title={selected ? `${t('stats.freqTitle')} · ${selected}` : t('stats.freqTitle')}
            subtitle={t('stats.freqSubtitle')}
            tone="teal"
          />
          <Text style={styles.metaLine}>
            {t(`stats.filters.${period}`)} · {selected || t('stats.freqSelectTitle')}
          </Text>
        </View>

        <View style={styles.filterRow}>
          {(['7d', '30d', '90d', 'all'] as PeriodKey[]).map((p) => {
            const active = period === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`stats.filters.${p}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.exercisePicker}>
          <TouchableOpacity
            style={[styles.chip, styles.chipActive]}
            onPress={() => {
              router.push('/training-frequency/select');
            }}
            activeOpacity={0.9}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>
              {selected || t('stats.freqSelectTitle')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sammanfattning */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqSummary')}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqSessions')}</Text>
              <Text style={styles.summaryValue}>{summary.sessions}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqSets')}</Text>
              <Text style={styles.summaryValue}>{summary.totalSets}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqReps')}</Text>
              <Text style={styles.summaryValue}>{summary.totalReps}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqVolume')}</Text>
              <Text style={styles.summaryValue}>{Math.round(summary.totalVolume)}</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqAvgSets')}</Text>
              <Text style={styles.summaryValue}>{summary.avgSets}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqAvgReps')}</Text>
              <Text style={styles.summaryValue}>{summary.avgReps}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>{t('stats.freqAvgVolume')}</Text>
              <Text style={styles.summaryValue}>{summary.avgVolume}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Frekvens över tid */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqOverTime')}</Text>
          {grouped.length === 0 ? (
            <Text style={styles.emptyText}>{t('stats.freqEmpty')}</Text>
          ) : (
            grouped.map((g) => {
              const barWidth = Math.min(100, g.sessions * 12 + 20);
              return (
                <View key={g.month} style={styles.freqRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.freqMonth}>{g.month}</Text>
                  <Text style={styles.freqValue}>
                      {g.sessions} {t('stats.muscleSortSessions')} · {g.sets} set · {g.reps} reps
                  </Text>
                  </View>
                  <View style={styles.miniBarBg}>
                    <View style={[styles.miniBarFill, { width: `${barWidth}%` }]} />
                  </View>
                  <Text style={styles.freqValueSmall}>{Math.round(g.volume)} {t('stats.freqVolumeShort')}</Text>
                </View>
              );
            })
          )}
        </GlassCard>

        {/* Mest tränade övningar */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqTop')}</Text>
          <View style={styles.filterRow}>
            {['sessions', 'sets', 'reps', 'volume'].map((opt) => {
              const active = topSort === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setTopSort(opt as typeof topSort)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt === 'sessions'
                      ? t('stats.muscleSortSessions')
                      : opt === 'sets'
                      ? t('stats.muscleSortSets')
                      : opt === 'reps'
                      ? t('stats.muscleSortReps')
                      : t('stats.muscleSortVolume')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {topExercises.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('stats.freqEmpty')}</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/workout/quick-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.start')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/schedule-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.weekEmptyCTA')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            topExercises.map((ex) => (
              <View key={ex.name} style={styles.passRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passDate}>{ex.name}</Text>
                  <Text style={styles.passMeta}>
                    {ex.sessions} {t('stats.freqSessions').toLowerCase()} · {ex.sets} {t('stats.freqSets').toLowerCase()} · {ex.reps} {t('stats.freqReps').toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.passWeight}>
                  {topSort === 'sessions'
                    ? `${ex.sessions} ${t('stats.freqSessions').toLowerCase()}`
                    : topSort === 'sets'
                    ? `${ex.sets} ${t('stats.freqSets').toLowerCase()}`
                    : topSort === 'reps'
                    ? `${ex.reps} ${t('stats.freqReps').toLowerCase()}`
                    : `${Math.round(ex.volume)} ${t('stats.freqVolumeShort')}`}
                </Text>
              </View>
            ))
          )}
        </GlassCard>

        {/* Detalj per pass */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqDetails')}</Text>
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('stats.freqEmpty')}</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/workout/quick-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.start')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/schedule-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.weekEmptyCTA')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            filtered
              .slice()
              .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate))
              .map((r, idx) => (
                <View key={`${r.workoutDate}-${idx}`} style={styles.passRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passDate}>{r.workoutDate}</Text>
                    <Text style={styles.passMeta}>
                      {r.sets} {t('stats.freqSets').toLowerCase()} · {r.reps} {t('stats.freqReps').toLowerCase()} · {Math.round(r.volume)} {t('stats.freqVolume').toLowerCase()}
                    </Text>
                  </View>
                  <Text style={styles.passWeight}>{r.maxWeight > 0 ? `${r.maxWeight} kg` : '–'}</Text>
                </View>
              ))
          )}
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
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
  metaLine: {
    ...typography.micro,
    color: colors.textMuted,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  card: {
    marginTop: 16,
    paddingHorizontal: 6,
  },
  section: {
    marginTop: 18,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0c1224',
    minHeight: 34,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#151030',
  },
  chipText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.primary,
  },
  cardTitle: {
    ...typography.title,
    color: '#e5e7eb',
  },
  cardText: {
    ...typography.caption,
    color: '#cbd5e1',
    marginTop: 2,
  },
  exercisePicker: {
    marginTop: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  summaryCard: {
    marginTop: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  summaryBox: {
    flexGrow: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1b2234',
    backgroundColor: '#0c152b',
  },
  summaryLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  summaryValue: {
    ...typography.title,
    color: colors.textMain,
    marginTop: 2,
  },
  freqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0c152b',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  freqMonth: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  freqValue: {
    ...typography.caption,
    color: colors.textSoft,
  },
  passRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0c152b',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  passDate: {
    ...typography.bodyBold,
    color: '#e5e7eb',
  },
  passMeta: {
    ...typography.caption,
    color: '#cbd5e1',
  },
  passWeight: {
    ...typography.bodyBold,
    color: '#e5e7eb',
  },
  headerBlock: {
    gap: 2,
    marginBottom: 4,
  },
  backRow: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  miniBarBg: {
    width: 80,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginHorizontal: 8,
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  freqValueSmall: {
    ...typography.micro,
    color: colors.textSoft,
  },
  emptyBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
    marginTop: 6,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
