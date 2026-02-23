// app/exercise-progress/muscles.tsx
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../../components/ui/GlassCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import BackPill from '../../components/ui/BackPill';
import { colors, gradients, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import { useRouter } from 'expo-router';

export default function MuscleGroupsScreen() {
  const router = useRouter();
  const { workouts } = useWorkouts();
  const { t } = useTranslation();

  const muscles = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        sessions: number;
        sets: number;
        volume: number;
        lastDate: string | null;
      }
    >();
    workouts
      .filter((w) => w.isCompleted)
      .forEach((w) => {
        (w.exercises || []).forEach((ex) => {
          const key = (ex.muscleGroup || 'Övrigt').trim() || 'Övrigt';
          if (!map.has(key)) {
            map.set(key, {
              name: key,
              sessions: 0,
              sets: 0,
              volume: 0,
              lastDate: null,
            });
          }
          const entry = map.get(key)!;
          entry.sessions += 1;
          entry.sets += ex.sets || 0;
          const sets = ex.performedSets || [];
          entry.volume += sets.reduce((acc, s) => {
            const reps = Number(String(s.reps).match(/\d+/)?.[0] || 0);
            const wt = Number(s.weight) || 0;
            return acc + reps * wt;
          }, 0);
          if (!entry.lastDate || w.date > entry.lastDate) entry.lastDate = w.date;
        });
      });
    const arr = Array.from(map.values());
    const totalSets = arr.reduce((s, m) => s + m.sets, 0) || 1;
    return arr
      .map((m) => ({
        ...m,
        share: Math.round((m.sets / totalSets) * 100),
      }))
      .sort((a, b) => b.sets - a.sets);
  }, [workouts]);

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
        <ScreenHeader title={t('stats.muscleTitle')} subtitle={t('stats.muscleSubtitle')} tone="green" />

        {muscles.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{t('stats.muscleEmpty')}</Text>
            <Text style={styles.emptyText}>{t('stats.muscleNoDate')}</Text>
          </View>
        ) : (
          muscles.map((m) => (
            <GlassCard key={m.name} style={styles.card} elevated={false}>
              <View style={styles.row}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.muscleName}>{m.name}</Text>
                  <View style={styles.tags}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{t('stats.muscleSessionsTag')}: {m.sessions}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{t('stats.muscleSetsTag')}: {m.sets}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {t('stats.muscleLast')}: {m.lastDate ?? '–'}
                      </Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{t('stats.muscleVolumeTag')}: {Math.round(m.volume)}</Text>
                    </View>
                  </View>
                  <View style={styles.barRow}>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${Math.min(100, m.share)}%` }]} />
                    </View>
                    <Text style={styles.barText}>{m.share}% av set</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          ))
        )}
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
  backRow: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  barRow: {
    marginTop: 10,
    gap: 6,
  },
  barBg: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  barText: {
    ...typography.micro,
    color: colors.textSoft,
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
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 4,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
  },
  card: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  muscleName: {
    ...typography.title,
    color: colors.textMain,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  tagText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
});
