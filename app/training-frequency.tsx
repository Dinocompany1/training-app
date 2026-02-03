// app/training-frequency.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../components/ui/GlassCard';
import { colors, gradients, typography } from '../constants/theme';
import { useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';

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

  const now = new Date();
  const cutoff = useMemo(() => {
    if (period === 'all') return null;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [period]);

  const completed = useMemo(
    () =>
      workouts.filter((w) => w.isCompleted).filter((w) => {
        if (!cutoff) return true;
        return w.date >= cutoff;
      }),
    [workouts, cutoff]
  );

  const exercises = useMemo(() => {
    const names = new Set<string>();
    workouts
      .filter((w) => w.isCompleted)
      .forEach((w) =>
        (w.exercises || []).forEach((ex) => {
          if (ex.name) names.add(ex.name);
        })
      );
    return Array.from(names).sort();
  }, [workouts]);

  const filtered = useMemo(() => {
    return completed.flatMap((w) =>
      (w.exercises || [])
        .filter((ex) => ex.name && (!selected || ex.name === selected))
        .map((ex) => {
          const performed = ex.performedSets && ex.performedSets.length > 0 ? ex.performedSets : [];
          const setCount = ex.sets || performed.length || 0;
          const repTotal =
            performed.length > 0
              ? performed.reduce((acc, s) => acc + (Number(String(s.reps)) || 0), 0)
              : 0;
          const volume =
            performed.length > 0
              ? performed.reduce((acc, s) => {
                  const repsNum = Number(String(s.reps)) || 0;
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

  const lifetime = useMemo(() => {
    const all = workouts.filter((w) => w.isCompleted).flatMap((w) =>
      (w.exercises || [])
        .filter((ex) => ex.name && (!selected || ex.name === selected))
        .map((ex) => ({
          sets: ex.sets || 0,
          reps: Number(ex.reps) || 0,
          volume:
            ex.performedSets?.reduce((acc, s) => {
              const repsNum = Number(String(s.reps)) || 0;
              const wt = Number(s.weight) || 0;
              return acc + repsNum * wt;
            }, 0) || 0,
        }))
    );
    return {
      sessions: all.length,
      sets: all.reduce((s, r) => s + r.sets, 0),
      reps: all.reduce((s, r) => s + r.reps, 0),
      volume: all.reduce((s, r) => s + r.volume, 0),
    };
  }, [workouts, selected]);

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
            ? performed.reduce((acc, s) => acc + (Number(String(s.reps)) || 0), 0)
            : 0;
        const volume =
          performed.length > 0
            ? performed.reduce((acc, s) => {
                const repsNum = Number(String(s.reps)) || 0;
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
          <Text style={styles.title}>
            {selected
              ? `${t('stats.freqTitle', 'Träningsfrekvens')} · ${selected}`
              : t('stats.freqTitle', 'Träningsfrekvens')}
          </Text>
          <Text style={styles.subtitle}>
            {t('stats.freqSubtitle', 'Se hur ofta och hur mycket du tränar en övning.')}
          </Text>
          <Text style={styles.metaLine}>
            {t(`stats.filters.${period}`, period)} · {selected || t('stats.freqSelectTitle', 'Välj övning')}
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
                  {t(`stats.filters.${p}`, p)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.exercisePicker}>
          <TouchableOpacity
            style={[styles.chip, styles.chipActive]}
            onPress={() => {
              router.replace('/training-frequency/select');
            }}
            activeOpacity={0.9}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>
              {selected || t('stats.freqSelectTitle', 'Välj övning')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sammanfattning */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqSummary', 'Sammanfattning')}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Pass</Text>
              <Text style={styles.summaryValue}>{summary.sessions}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Set</Text>
              <Text style={styles.summaryValue}>{summary.totalSets}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Reps</Text>
              <Text style={styles.summaryValue}>{summary.totalReps}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Volym</Text>
              <Text style={styles.summaryValue}>{Math.round(summary.totalVolume)}</Text>
            </View>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Snitt set/pass</Text>
              <Text style={styles.summaryValue}>{summary.avgSets}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Snitt reps/pass</Text>
              <Text style={styles.summaryValue}>{summary.avgReps}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Snitt volym/pass</Text>
              <Text style={styles.summaryValue}>{summary.avgVolume}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Frekvens över tid */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqOverTime', 'Frekvens över tid')}</Text>
          {grouped.length === 0 ? (
            <Text style={styles.emptyText}>{t('stats.freqEmpty', 'Inga pass i vald period.')}</Text>
          ) : (
            grouped.map((g) => {
              const barWidth = Math.min(100, g.sessions * 12 + 20);
              return (
                <View key={g.month} style={styles.freqRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.freqMonth}>{g.month}</Text>
                    <Text style={styles.freqValue}>
                      {g.sessions} {t('stats.muscleSortSessions', 'Pass')} · {g.sets} set · {g.reps} reps
                    </Text>
                  </View>
                  <View style={styles.miniBarBg}>
                    <View style={[styles.miniBarFill, { width: `${barWidth}%` }]} />
                  </View>
                  <Text style={styles.freqValueSmall}>{Math.round(g.volume)} vol</Text>
                </View>
              );
            })
          )}
        </GlassCard>

        {/* Mest tränade övningar */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqTop', 'Mest tränade övningar')}</Text>
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
                      ? t('stats.muscleSortSessions', 'Pass')
                      : opt === 'sets'
                      ? t('stats.muscleSortSets', 'Set')
                      : opt === 'reps'
                      ? t('stats.muscleSortReps', 'Reps')
                      : t('stats.muscleSortVolume', 'Volym')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {topExercises.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('stats.freqEmpty', 'Inga pass i vald period.')}</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/workout/quick-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.start', 'Starta pass')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/schedule-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.weekEmptyCTA', 'Planera')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            topExercises.map((ex) => (
              <View key={ex.name} style={styles.passRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passDate}>{ex.name}</Text>
                  <Text style={styles.passMeta}>
                    {ex.sessions} pass · {ex.sets} set · {ex.reps} reps
                  </Text>
                </View>
                <Text style={styles.passWeight}>
                  {topSort === 'sessions'
                    ? `${ex.sessions} pass`
                    : topSort === 'sets'
                    ? `${ex.sets} set`
                    : topSort === 'reps'
                    ? `${ex.reps} reps`
                    : `${Math.round(ex.volume)} vol`}
                </Text>
              </View>
            ))
          )}
        </GlassCard>

        {/* Detalj per pass */}
        <GlassCard style={[styles.card, styles.section]} elevated={false}>
          <Text style={styles.cardTitle}>{t('stats.freqDetails', 'Detaljer per pass')}</Text>
          {filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('stats.freqEmpty', 'Inga pass i vald period.')}</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/workout/quick-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.start', 'Starta pass')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => router.push('/schedule-workout')}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, styles.chipTextActive]}>{t('home.weekEmptyCTA', 'Planera')}</Text>
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
                      {r.sets} set · {r.reps} reps · {Math.round(r.volume)} volym
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
