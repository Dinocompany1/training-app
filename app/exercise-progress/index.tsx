// app/exercise-progress/index.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import { colors, gradients, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { EXERCISE_IMAGE_MAP, CustomExercise } from '../../constants/exerciseLibrary';
import { useTranslation } from '../../context/TranslationContext';
import EmptyState from '../../components/ui/EmptyState';
import Svg, { Polyline, Circle } from 'react-native-svg';
import BackPill from '../../components/ui/BackPill';

interface ExerciseHistoryItem {
  date: string;
  sets: number;
  reps: string;
  weight: number;
}

interface ExerciseSummary {
  name: string;
  sessions: number;
  bestWeight: number;
  totalSets: number;
  lastDate: string;
  history: ExerciseHistoryItem[];
  imageUri?: string;
}

export default function ExerciseProgressListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ muscle?: string }>();
  const { workouts, customExercises } = useWorkouts();
  const { t } = useTranslation();
  const muscleFilter =
    params.muscle && typeof params.muscle === 'string'
      ? params.muscle.trim()
      : null;

  const summaries: ExerciseSummary[] = useMemo(() => {
    const map = new Map<string, ExerciseSummary>();

    workouts.forEach((workout) => {
      if (!workout.isCompleted) return;
      (workout.exercises || []).forEach((ex) => {
        if (!ex.name) return;
        if (muscleFilter && ex.muscleGroup && ex.muscleGroup !== muscleFilter) return;
        const key = ex.name;

        if (!map.has(key)) {
          map.set(key, {
            name: key,
            sessions: 0,
            bestWeight: 0,
            totalSets: 0,
            lastDate: workout.date,
            history: [],
          });
        }

        const entry = map.get(key)!;
        entry.sessions += 1;
        entry.totalSets += ex.sets || 0;
        if ((ex.weight || 0) > entry.bestWeight) {
          entry.bestWeight = ex.weight || 0;
        }
        if (new Date(workout.date) > new Date(entry.lastDate)) {
          entry.lastDate = workout.date;
        }

        const performed =
          ex.performedSets && ex.performedSets.length > 0
            ? ex.performedSets
            : Array.from({ length: ex.sets || 0 }).map(() => ({
                reps: ex.reps,
                weight: ex.weight,
              }));

        performed.forEach((set) => {
          entry.history.push({
            date: workout.date,
            sets: 1,
            reps: set.reps,
            weight: set.weight || 0,
          });
        });
      });
    });

    const arr = Array.from(map.values());

    // sortera: senast tränade överst
    arr.sort(
      (a, b) =>
        new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    );

    return arr;
  }, [workouts, customExercises, muscleFilter]);

  return (
    <SafeAreaView style={styles.full}>
      <LinearGradient
        colors={gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backRow}>
          <BackPill onPress={() => router.back()} />
        </View>
        <Text style={styles.title}>
          {muscleFilter
            ? `${t('exerciseProgress.title')} · ${muscleFilter}`
            : t('exerciseProgress.title')}
        </Text>
        <Text style={styles.subtitle}>
          {muscleFilter
            ? t('exerciseProgress.subtitle')
            : t('exerciseProgress.subtitle')}
        </Text>

        {summaries.length === 0 ? (
          <EmptyState
            title={
              muscleFilter
                ? t('exerciseProgress.emptyTitle')
                : t('exerciseProgress.emptyTitle')
            }
            subtitle={
              muscleFilter
                ? t('exerciseProgress.emptySubtitle')
                : t('exerciseProgress.emptySubtitle')
            }
            ctaLabel={t('exerciseProgress.emptyCta')}
            onPressCta={() => router.push('/workout/quick-workout')}
          />
        ) : (
          summaries.map((ex) => (
            <GlassCard key={ex.name} style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/exercise-progress/[name]',
                    params: { name: ex.name },
                  })
                }
                accessibilityLabel={`Visa historik för ${ex.name}`}
                accessibilityRole="button"
              >
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Dumbbell size={18} color={colors.accentBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                    <View style={styles.muscleTags}>
                      {muscleFilter ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{muscleFilter}</Text>
                        </View>
                      ) : null}
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>
                          {t('exerciseProgress.lastTrained', ex.lastDate)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.pillRow}>
                  <View style={styles.pillBox}>
                    <Text style={styles.pillLabel}>{t('exerciseProgress.sessions')}</Text>
                    <Text style={styles.pillValue}>{ex.sessions}</Text>
                  </View>
                  <View style={styles.pillBox}>
                    <Text style={styles.pillLabel}>{t('exerciseProgress.bestWeight')}</Text>
                    <Text style={styles.pillValue}>
                      {ex.bestWeight > 0 ? `${ex.bestWeight} kg` : '–'}
                    </Text>
                  </View>
                  <View style={styles.pillBox}>
                    <Text style={styles.pillLabel}>{t('exerciseProgress.totalSets')}</Text>
                    <Text style={styles.pillValue}>{ex.totalSets}</Text>
                  </View>
                  <View style={styles.pillBox}>
                    <Text style={styles.pillLabel}>{t('exerciseProgress.lastTrainedShort', 'Senast')}</Text>
                    <Text style={styles.pillValue}>{ex.lastDate}</Text>
                  </View>
                </View>

                {/* Mini-graf för vikt över tid */}
                <ExerciseSparkline history={ex.history} />

                <Text style={styles.tapHint}>
                  Tryck för att se full historik för denna övning →
                </Text>
              </TouchableOpacity>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backRow: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    color: colors.textMain,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
    marginBottom: 10,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 16,
  },
  card: {
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  exerciseName: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  pillBox: {
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#111827',
  },
  pillLabel: {
    ...typography.micro,
    color: colors.textSoft,
  },
  pillValue: {
    ...typography.title,
    fontSize: 14,
    color: colors.textMain,
    marginTop: 2,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#020617',
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
    fontSize: 15,
    color: colors.textMain,
    marginTop: 2,
  },
  tapHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 8,
  },
  muscleTags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  sparkContainer: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  sparkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sparkLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  sparkValue: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  sparkHint: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 4,
  },
});

function ExerciseSparkline({ history }: { history: { date: string; weight: number }[] }) {
  const { t } = useTranslation();
  if (!history || history.length === 0) {
    return (
      <View style={styles.sparkContainer}>
        <Text style={styles.sparkHint}>{t('exerciseProgress.emptySubtitle')}</Text>
      </View>
    );
  }
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last = sorted[sorted.length - 1]?.weight ?? 0;
  const first = sorted[0]?.weight ?? 0;
  const delta = last - first;
  const max = Math.max(...sorted.map((h) => h.weight), 1);
  const min = Math.min(...sorted.map((h) => h.weight), 0);
  const range = Math.max(max - min, 1);
  const w = 200;
  const h = 60;
  const pts = sorted.map((point, idx) => {
    const x = sorted.length === 1 ? w / 2 : (idx / (sorted.length - 1)) * w;
    const y = h - ((point.weight - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <View style={styles.sparkContainer}>
      <View style={styles.sparkHeader}>
        <Text style={styles.sparkLabel}>{t('exerciseProgress.frequency')}</Text>
        <Text style={styles.sparkValue}>{last} kg ({delta >= 0 ? '+' : ''}{delta} kg)</Text>
      </View>
      <Svg width={w} height={h}>
        <Polyline
          points={pts.join(' ')}
          fill="none"
          stroke={colors.accentGreen}
          strokeWidth={2}
        />
        {pts.map((p, idx) => {
          const [x, y] = p.split(',').map(Number);
          return <Circle key={idx} cx={x} cy={y} r={3} fill={colors.accentGreen} />;
        })}
      </Svg>
      <Text style={styles.sparkHint}>
        {t('exerciseProgress.lastTrainedShort', 'Senast')}: {sorted[sorted.length - 1]?.date ?? '-'}
      </Text>
    </View>
  );
}
