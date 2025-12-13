// app/exercise-progress/index.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import { colors, gradients, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import {
  EXERCISE_IMAGE_MAP,
  EXERCISE_LIBRARY,
  CustomExercise,
} from '../../constants/exerciseLibrary';
import { Image } from 'expo-image';

const PLACEHOLDER_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAZlBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////8F6kJ+AAAAIHRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyoyXwAAAChJREFUGNNjYGBgZGJmBgYWiJmFlYGRiYGRiZWBgYkB4hkZiRmBgYGRAAAWCwH4kG3QjgAAAABJRU5ErkJggg==';
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
  const { workouts, customExercises } = useWorkouts();

  const summaries: ExerciseSummary[] = useMemo(() => {
    const map = new Map<string, ExerciseSummary>();

    workouts.forEach((workout) => {
      (workout.exercises || []).forEach((ex) => {
        if (!ex.name) return;
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

    // fyll på med övningar från biblioteket som saknar loggningar
    const merged = [...EXERCISE_LIBRARY];
    // lägg in custom övningar i biblioteket så vi får bilder även där
    customExercises.forEach((ex) => {
      const found = merged.find((g) => g.group === ex.muscleGroup);
      if (found) {
        found.exercises.push({ name: ex.name, imageUri: ex.imageUri });
      } else {
        merged.push({ group: ex.muscleGroup, exercises: [{ name: ex.name, imageUri: ex.imageUri }] });
      }
    });

    merged.forEach((group) => {
      group.exercises.forEach((ex) => {
        if (!map.has(ex.name)) {
          map.set(ex.name, {
            name: ex.name,
            sessions: 0,
            bestWeight: 0,
            totalSets: 0,
            lastDate: '-',
            history: [],
          });
        }
      });
    });

    const arr = Array.from(map.values()).map((item) => ({
      ...item,
      imageUri: EXERCISE_IMAGE_MAP[item.name] || customExercises.find((ex) => ex.name === item.name)?.imageUri,
    }));

    // sortera: senast tränade överst
    arr.sort(
      (a, b) =>
        new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    );

    return arr;
  }, [workouts]);

  return (
    <LinearGradient
      colors={gradients.appBackground}
      style={styles.full}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Övningsprogress</Text>
        <Text style={styles.subtitle}>
          Se en snabb översikt över dina vanligaste övningar och utvecklingen i
          varje.
        </Text>

        {summaries.length === 0 ? (
          <EmptyState
            title="Ingen övningsdata ännu"
            subtitle="Logga ett pass för att se din övningsprogress här."
            ctaLabel="Logga pass"
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
                  <View style={styles.thumbWrapper}>
                    <Image
                      source={{ uri: ex.imageUri || PLACEHOLDER_IMG }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.iconCircle}>
                    <Dumbbell size={18} color={colors.accentBlue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      Senast tränad: {ex.lastDate}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Pass</Text>
                    <Text style={styles.statValue}>{ex.sessions}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Tyngsta vikt</Text>
                    <Text style={styles.statValue}>
                      {ex.bestWeight > 0 ? `${ex.bestWeight} kg` : '–'}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Totalt antal set</Text>
                    <Text style={styles.statValue}>{ex.totalSets}</Text>
                  </View>
                </View>

                {/* enkel "progressbar" för hur ofta den tränats */}
                <View style={styles.frequencyRow}>
                  <Text style={styles.frequencyLabel}>
                    Användningsfrekvens
                  </Text>
                  <View style={styles.frequencyBarBg}>
                    <View
                      style={[
                        styles.frequencyBarFill,
                        {
                          width: `${
                            Math.min(100, Math.max(15, ex.sessions * 8))
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.tapHint}>
                  Tryck för att se full historik för denna övning →
                </Text>
              </TouchableOpacity>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </LinearGradient>
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
  thumbWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: colors.backgroundSoft,
  },
  thumb: {
    width: '100%',
    height: '100%',
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
  frequencyRow: {
    marginTop: 10,
  },
  frequencyLabel: {
    ...typography.micro,
    color: colors.textSoft,
    marginBottom: 4,
  },
  frequencyBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#111827',
    overflow: 'hidden',
  },
  frequencyBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  tapHint: {
    ...typography.micro,
    color: colors.textSoft,
    marginTop: 8,
  },
});
