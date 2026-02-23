// app/pb-list.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
import { colors, gradients, radii, typography } from '../constants/theme';
import { useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';
import { compareISODate, formatDateShort } from '../utils/date';

export default function PBListScreen() {
  const { workouts } = useWorkouts();
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [sort, setSort] = useState<'date' | 'value' | 'name'>('date');
  const [category, setCategory] = useState<string>('__all__');

  type PBEvent = { name: string; weight: number; date: string; muscle?: string; delta?: number };

  const { pbs, summary, categories } = useMemo(() => {
    const map = new Map<string, PBEvent[]>();
    workouts
      .filter((w) => w.isCompleted)
      .forEach((w) => {
        (w.exercises || []).forEach((ex) => {
          if (!ex.name || !Number.isFinite(ex.weight) || ex.weight <= 0) return;
          const arr = map.get(ex.name) || [];
          arr.push({ name: ex.name, weight: ex.weight, date: w.date, muscle: ex.muscleGroup });
          map.set(ex.name, arr);
        });
      });

    // Bygg PB-händelser: varje gång vikten slår tidigare max
    const events: PBEvent[] = [];
    map.forEach((list) => {
      const sorted = list.sort((a, b) => compareISODate(a.date, b.date));
      let best = 0;
      sorted.forEach((ev) => {
        if (ev.weight > best) {
          const delta = best > 0 ? ev.weight - best : undefined;
          events.push({ ...ev, delta });
          best = ev.weight;
        }
      });
    });

    // Sammanfattning
    const activePBs = events.length;
    const latest = [...events].sort((a, b) => compareISODate(b.date, a.date))[0];
    const totalImprovement = events.reduce((sum, ev) => sum + (ev.delta ?? 0), 0);

    const categories = Array.from(
      new Set(events.map((e) => e.muscle || t('exercises.groups.Övrigt')))
    );

    return {
      pbs: events,
      summary: { activePBs, latest, totalImprovement },
      categories,
    };
  }, [t, workouts]);

  const filtered = pbs.filter((pb) =>
    category === '__all__'
      ? true
      : (pb.muscle || t('exercises.groups.Övrigt')) === category
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'value') return b.weight - a.weight;
    if (sort === 'name') return a.name.localeCompare(b.name);
    return compareISODate(b.date, a.date);
  });

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backRow}>
          <BackPill onPress={() => router.back()} />
        </View>
        <ScreenHeader title={t('stats.pbTitle')} subtitle={t('stats.pbSubtitle')} tone="amber" />

        <GlassCard style={styles.summaryCard} elevated={false}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('stats.pbActive')}</Text>
              <Text style={styles.summaryValue}>{summary.activePBs}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('stats.pbLatest')}</Text>
              <Text style={styles.summaryValue}>
                {summary.latest ? `${summary.latest.name} · ${summary.latest.date}` : '–'}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('stats.pbTotalImprovement')}</Text>
              <Text style={styles.summaryValue}>{Math.round(summary.totalImprovement)} kg</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.filterRow}>
          {['date', 'value', 'name'].map((opt) => {
            const active = sort === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSort(opt as typeof sort)}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>
                  {opt === 'date'
                    ? t('stats.sortDate')
                    : opt === 'value'
                    ? t('stats.sortValue')
                    : t('stats.sortName')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.sortChip, category === '__all__' && styles.sortChipActive]}
            onPress={() => setCategory('__all__')}
          >
            <Text style={[styles.sortText, category === '__all__' && styles.sortTextActive]}>
              {t('stats.filters.all')}
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.sortText, active && styles.sortTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('stats.pbEmpty')}
          </Text>
        ) : (
          <>
            {sorted.map((pb, idx) => (
            <GlassCard key={`${pb.name}-${pb.date}-${pb.weight}-${idx}`} style={styles.card} elevated={false}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  router.push({
                    pathname: '/exercise-progress/[name]',
                    params: { name: pb.name },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('stats.pbOpenA11y', undefined, pb.name)}
              >
                <View style={[styles.row, idx > 0 ? styles.rowWithDivider : null]}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.pbName}>{pb.name}</Text>
                    {pb.delta != null ? (
                      <Text style={styles.pbDate}>{t('stats.pbDelta', undefined, pb.delta)}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.pbDate, { flex: 1, textAlign: 'center' }]}>
                    {formatDateShort(pb.date, lang)}
                  </Text>
                  <Text style={[styles.pbWeight, { flex: 1, textAlign: 'right' }]}>{pb.weight} kg</Text>
                </View>
              </TouchableOpacity>
            </GlassCard>
          ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  backRow: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
    marginBottom: 12,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  summaryCard: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
  },
  summaryLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 2,
  },
  card: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingVertical: 10,
  },
  rowWithDivider: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  pbName: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  pbDate: {
    ...typography.micro,
    color: colors.textMuted,
  },
  pbWeight: {
    ...typography.bodyBold,
    color: colors.accentGreen,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  sortChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  sortChipActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#1e3a8a',
  },
  sortText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  sortTextActive: {
    color: '#dbeafe',
  },
});
