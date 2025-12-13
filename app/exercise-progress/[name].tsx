// app/exercise-progress/[name].tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Trophy } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import { colors, gradients } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';

interface ExerciseHistoryRow {
  date: string;
  sets: number;
  reps: string;
  weight: number;
  volume: number;
}

export default function ExerciseProgressDetailScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const router = useRouter();
  const { workouts } = useWorkouts();

  const exerciseName = Array.isArray(name) ? name[0] : name;

  const history: ExerciseHistoryRow[] = useMemo(() => {
    if (!exerciseName) return [];

    const rows: ExerciseHistoryRow[] = [];

    workouts.forEach((workout) => {
      (workout.exercises || [])
        .filter((ex) => ex.name === exerciseName)
        .forEach((ex) => {
          const performed =
            ex.performedSets && ex.performedSets.length > 0
              ? ex.performedSets
              : Array.from({ length: ex.sets || 0 }).map(() => ({
                  reps: ex.reps,
                  weight: ex.weight,
                }));

          performed.forEach((set) => {
            const repsNum = Number(set.reps) || 0;
            const weightNum = set.weight || 0;
            rows.push({
              date: workout.date,
              sets: 1,
              reps: set.reps,
              weight: weightNum,
              volume: repsNum * weightNum,
            });
          });
        });
    });

    // sortera i datumordning
    rows.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return rows;
  }, [workouts, exerciseName]);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        sessions: 0,
        bestWeight: 0,
        bestVolume: 0,
        firstDate: null as string | null,
        lastDate: null as string | null,
        trend: 0,
      };
    }

    const sessions = history.length;
    const bestWeight = Math.max(...history.map((h) => h.weight));
    const bestVolume = Math.max(...history.map((h) => h.volume));

    const firstDate = history[0].date;
    const lastDate = history[history.length - 1].date;

    // enkel trend: jämför senaste vikt med första
    const firstWeight = history[0].weight || 0;
    const lastWeight = history[history.length - 1].weight || 0;
    const trend =
      firstWeight > 0
        ? Math.round(((lastWeight - firstWeight) / firstWeight) * 100)
        : 0;

    return {
      sessions,
      bestWeight,
      bestVolume,
      firstDate,
      lastDate,
      trend,
    };
  }, [history]);

  const maxWeight = history.length
    ? Math.max(...history.map((h) => h.weight || 0))
    : 0;

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
        {/* header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backPill}
            onPress={() => router.back()}
            accessibilityLabel="Tillbaka"
            accessibilityRole="button"
          >
            <ArrowLeft size={14} color={colors.textSoft} />
            <Text style={styles.backText}>Tillbaka</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>
          {exerciseName || 'Övning'}
        </Text>
        <Text style={styles.subtitle}>
          Här ser du din utveckling, dina tyngsta vikter och historik för denna
          övning.
        </Text>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>
            Du har inte loggat den här övningen ännu.
          </Text>
        ) : (
          <>
            {/* Översiktskort */}
            <GlassCard style={styles.card}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Antal pass</Text>
                  <Text style={styles.summaryValue}>
                    {stats.sessions}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>
                    Tyngsta vikt
                  </Text>
                  <Text style={styles.summaryValue}>
                    {stats.bestWeight} kg
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Starkare?</Text>
                  <View style={styles.trendRow}>
                    <TrendingUp
                      size={14}
                      color={
                        stats.trend > 0
                          ? colors.accentGreen
                          : stats.trend < 0
                          ? '#f97316'
                          : colors.textSoft
                      }
                    />
                    <Text style={styles.summaryValueSmall}>
                      {stats.trend > 0
                        ? `+${stats.trend}%`
                        : `${stats.trend}%`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.datesRow}>
                <View>
                  <Text style={styles.summaryLabel}>
                    Första passet
                  </Text>
                  <Text style={styles.summaryDate}>
                    {stats.firstDate}
                  </Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>
                    Senaste passet
                  </Text>
                  <Text style={styles.summaryDate}>
                    {stats.lastDate}
                  </Text>
                </View>
              </View>

              <View style={styles.prRow}>
                <View style={styles.prIconCircle}>
                  <Trophy size={16} color="#facc15" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prTitle}>Personligt rekord</Text>
                  <Text style={styles.prText}>
                    Tyngsta set: {stats.bestWeight} kg
                  </Text>
                  <Text style={styles.prTextSmall}>
                    Fortsätt logga dina pass för att slå dina rekord oftare.
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Pseudo-graf: vikter över tid */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Vikt över tid</Text>
              <Text style={styles.cardText}>
                Varje stapel visar tyngsta setet per pass.
              </Text>

              <View style={styles.graphContainer}>
                {history.map((h, index) => {
                  const ratio =
                    maxWeight > 0 ? h.weight / maxWeight : 0;
                  const height = Math.max(10, ratio * 70); // px

                  return (
                    <View
                      key={index}
                      style={styles.graphItem}
                    >
                      <View
                        style={[
                          styles.graphBar,
                          { height },
                        ]}
                      />
                      <Text style={styles.graphWeight}>
                        {h.weight > 0 ? `${h.weight}` : '–'}
                      </Text>
                      <Text style={styles.graphDate}>
                        {h.date.slice(5)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </GlassCard>

            {/* Detaljerad historik */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Historik</Text>
              <Text style={styles.cardText}>
                Alla pass där du har loggat denna övning.
              </Text>

              {history.map((h, index) => (
                <View
                  key={`${h.date}-${index}`}
                  style={styles.historyRow}
                  accessibilityLabel={`Datum ${h.date}. ${h.sets} set, ${h.reps} reps, ${h.weight} kilo. Volym ${Math.round(h.volume)}.`}
                  accessibilityRole="text"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>
                      {h.date}
                    </Text>
                    <Text style={styles.historyText}>
                      {h.sets} set × {h.reps} reps
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyWeight}>
                      {h.weight} kg
                    </Text>
                    <Text style={styles.historyVolume}>
                      Volym: {Math.round(h.volume)}
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          </>
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
  headerRow: {
    marginBottom: 4,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  backText: {
    color: colors.textSoft,
    fontSize: 12,
  },
  title: {
    color: colors.textMain,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 10,
  },
  emptyText: {
    color: colors.textSoft,
    fontSize: 13,
    marginTop: 16,
  },
  card: {
    marginTop: 10,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#111827',
  },
  summaryLabel: {
    color: colors.textSoft,
    fontSize: 11,
  },
  summaryValue: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryValueSmall: {
    color: colors.textMain,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  summaryDate: {
    color: colors.textMain,
    fontSize: 12,
    marginTop: 2,
  },

  prRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  prIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  prTitle: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: '700',
  },
  prText: {
    color: colors.textSoft,
    fontSize: 12,
  },
  prTextSmall: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
  },

  cardTitle: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '700',
  },
  cardText: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 2,
  },

  graphContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    paddingHorizontal: 6,
  },
  graphItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  graphBar: {
    width: '60%',
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
  },
  graphWeight: {
    color: colors.textMain,
    fontSize: 10,
    marginTop: 2,
  },
  graphDate: {
    color: colors.textSoft,
    fontSize: 9,
  },

  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  historyDate: {
    color: colors.textMain,
    fontSize: 13,
    fontWeight: '600',
  },
  historyText: {
    color: colors.textSoft,
    fontSize: 11,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyWeight: {
    color: colors.textMain,
    fontSize: 13,
    fontWeight: '600',
  },
  historyVolume: {
    color: colors.textSoft,
    fontSize: 11,
  },
});
