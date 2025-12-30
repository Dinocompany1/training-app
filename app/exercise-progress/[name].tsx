// app/exercise-progress/[name].tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import GlassCard from '../../components/ui/GlassCard';
import { colors, gradients } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';

type SessionRow = {
  date: string;
  sets: number;
  totalReps: number;
  totalVolume: number;
  bestWeight: number;
};

export default function ExerciseProgressDetailScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const router = useRouter();
  const { workouts } = useWorkouts();
  const { t } = useTranslation();

  const exerciseName = Array.isArray(name) ? name[0] : name;

  const sessions: SessionRow[] = useMemo(() => {
    if (!exerciseName) return [];

    const rows: SessionRow[] = [];

    workouts
      .filter((w) => w.isCompleted)
      .forEach((workout) => {
        const exercises = (workout.exercises || []).filter(
          (ex) => ex.name === exerciseName
        );

        if (exercises.length === 0) return;

        let sets = 0;
        let totalReps = 0;
        let totalVolume = 0;
        let bestWeight = 0;

        exercises.forEach((ex) => {
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
            sets += 1;
            totalReps += repsNum;
            totalVolume += repsNum * weightNum;
            bestWeight = Math.max(bestWeight, weightNum);
          });
        });

        rows.push({
          date: workout.date,
          sets,
          totalReps,
          totalVolume,
          bestWeight,
        });
      });

    rows.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return rows;
  }, [workouts, exerciseName]);

  const stats = useMemo(() => {
    if (sessions.length === 0) {
      return {
        sessions: 0,
        bestWeight: 0,
        firstDate: null as string | null,
        lastDate: null as string | null,
        trend: 0,
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
      };
    }

    const bestWeight = Math.max(...sessions.map((h) => h.bestWeight));
    const totalSets = sessions.reduce((acc, h) => acc + h.sets, 0);
    const totalReps = sessions.reduce((acc, h) => acc + h.totalReps, 0);
    const totalVolume = sessions.reduce((acc, h) => acc + h.totalVolume, 0);

    const firstDate = sessions[0].date;
    const lastDate = sessions[sessions.length - 1].date;

    // enkel trend: jämför senaste vikt med första
    const firstWeight = sessions[0].bestWeight || 0;
    const lastWeight = sessions[sessions.length - 1].bestWeight || 0;
    const trend =
      firstWeight > 0
        ? Math.round(((lastWeight - firstWeight) / firstWeight) * 100)
        : 0;

    return {
      sessions: sessions.length,
      bestWeight,
      firstDate,
      lastDate,
      trend,
      totalSets,
      totalReps,
      totalVolume,
    };
  }, [sessions]);

  const maxWeight = sessions.length
    ? Math.max(...sessions.map((h) => h.bestWeight || 0))
    : 0;

  const sparkPoints = useMemo(() => {
    if (sessions.length === 0 || maxWeight === 0) return [];
    const len = sessions.length;
    return sessions.map((s, idx) => {
      const x = (idx / Math.max(1, len - 1)) * 100;
      const y = 100 - (s.bestWeight / maxWeight) * 100;
      return { x, y, weight: s.bestWeight, date: s.date };
    });
  }, [sessions, maxWeight]);

  const firstDateLabel = stats.firstDate || '–';
  const lastDateLabel = stats.lastDate || '–';

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
            accessibilityLabel={t('exerciseDetail.backA11y')}
            accessibilityRole="button"
          >
            <ArrowLeft size={14} color={colors.textSoft} />
            <Text style={styles.backText}>{t('exerciseDetail.back')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>
          {exerciseName || t('exerciseDetail.unnamed')}
        </Text>
        <Text style={styles.subtitle}>
          {t('exerciseDetail.subtitle')}
        </Text>

        {sessions.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('exerciseDetail.empty')}
          </Text>
        ) : (
          <>
            {/* Översiktskort */}
            <GlassCard style={styles.card}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('exerciseDetail.sessions')}</Text>
                  <Text style={styles.summaryValue}>{stats.sessions}</Text>
                  <Text style={styles.summaryHint}>{t('exerciseDetail.latestSession')} {lastDateLabel}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{t('exerciseDetail.stronger')}</Text>
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
                      {stats.trend > 0 ? `+${stats.trend}%` : `${stats.trend}%`}
                    </Text>
                  </View>
                  <Text style={styles.summaryHint}>
                    {t('exerciseDetail.firstSession')} {firstDateLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.datesRow}>
                <View style={styles.kpiBox}>
                  <Text style={styles.summaryLabel}>{t('exerciseDetail.sets')}</Text>
                  <Text style={styles.summaryValue}>{stats.totalSets}</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.summaryLabel}>{t('exerciseDetail.reps')}</Text>
                  <Text style={styles.summaryValue}>{stats.totalReps}</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.summaryLabel}>{t('exerciseDetail.volume')}</Text>
                  <Text style={styles.summaryValue}>{Math.round(stats.totalVolume)}</Text>
                </View>
                <View style={styles.kpiBox}>
                  <Text style={styles.summaryLabel}>{t('exerciseDetail.bestWeight')}</Text>
                  <Text style={styles.summaryValue}>{stats.bestWeight} kg</Text>
                </View>
              </View>

            </GlassCard>

            {/* Sparkline vikttrend */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{t('exerciseDetail.weightTrendTitle')}</Text>
              <Text style={styles.cardText}>
                {t('exerciseDetail.weightTrendSub')}
              </Text>

              <View style={styles.sparkWrapper}>
                <Svg height="140" width="100%">
                  {sparkPoints.length > 1 && (
                    <Polyline
                      points={sparkPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={colors.accentPurple}
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                  )}
                  {sparkPoints.map((p, idx) => (
                    <Circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={3.2}
                      fill={colors.accentPurple}
                    />
                  ))}
                </Svg>
                <View style={styles.sparkLabels}>
                  <Text style={styles.sparkLabel}>
                    {t('exerciseDetail.firstSession')} {firstDateLabel}
                  </Text>
                  <Text style={styles.sparkLabel}>
                    {t('exerciseDetail.latestSession')} {lastDateLabel}
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Detaljerad historik */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{t('exerciseDetail.historyTitle')}</Text>
              <Text style={styles.cardText}>
                {t('exerciseDetail.historySubtitle')}
              </Text>

              {[...sessions]
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .map((h, index) => (
                <View
                  key={`${h.date}-${index}`}
                  style={styles.historyRow}
                  accessibilityLabel={`Datum ${h.date}. ${h.sets} set, ${h.totalReps} reps, ${h.bestWeight} kilo. Volym ${Math.round(h.totalVolume)}.`}
                  accessibilityRole="text"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>
                      {h.date}
                    </Text>
                    <Text style={styles.historyText}>
                      {h.sets} set × {h.totalReps} reps
                    </Text>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyWeight}>
                      {h.bestWeight} kg
                    </Text>
                    <Text style={styles.historyVolume}>
                      Volym: {Math.round(h.totalVolume)}
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
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
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
  summaryHint: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  datesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  kpiBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#111827',
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

  sparkWrapper: {
    marginTop: 12,
    backgroundColor: '#020617',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 10,
  },
  sparkLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sparkLabel: {
    color: colors.textSoft,
    fontSize: 11,
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
