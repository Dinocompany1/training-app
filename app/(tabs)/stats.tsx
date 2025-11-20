import React, { useMemo } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useWorkouts } from '../../context/WorkoutsContext';

export default function StatsScreen() {
  const { workouts, weeklyGoal } = useWorkouts();

  const today = new Date();

  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7);
  };

  const thisWeek = getWeekNumber(today);
  const thisYear = today.getFullYear();

  const { totalPass, thisWeekPass, lastWeekPass } = useMemo(() => {
    let total = workouts.length;
    let weekThis = 0;
    let weekLast = 0;

    workouts.forEach((w) => {
      const d = new Date(w.date);
      if (isNaN(d.getTime())) return;

      const week = getWeekNumber(d);
      const year = d.getFullYear();

      if (year === thisYear && week === thisWeek) {
        weekThis++;
      } else if (year === thisYear && week === thisWeek - 1) {
        weekLast++;
      }
    });

    return {
      totalPass: total,
      thisWeekPass: weekThis,
      lastWeekPass: weekLast,
    };
  }, [workouts]);

  const progress =
    weeklyGoal > 0 ? Math.min(thisWeekPass / weeklyGoal, 1) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Statistik</Text>
        <Text style={styles.subtitle}>
          Överblick på din träning baserat på pass du loggat.
        </Text>

        {/* Veckomål */}
        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Veckomål</Text>
          {weeklyGoal > 0 ? (
            <>
              <Text style={styles.goalText}>
                Mål: {weeklyGoal} pass / vecka
              </Text>
              <Text style={styles.goalText}>
                Den här veckan: {thisWeekPass} / {weeklyGoal}
              </Text>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progress * 100}%` },
                  ]}
                />
              </View>
            </>
          ) : (
            <Text style={styles.goalText}>
              Inget veckomål satt ännu. Gå till Profil för att välja ett mål.
            </Text>
          )}
        </View>

        {/* Total pass */}
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalPass}</Text>
          <Text style={styles.statLabel}>Totalt antal pass</Text>
        </View>

        {/* Denna vecka */}
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{thisWeekPass}</Text>
          <Text style={styles.statLabel}>Den här veckan</Text>
        </View>

        {/* Förra veckan */}
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{lastWeekPass}</Text>
          <Text style={styles.statLabel}>Förra veckan</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#050816',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5f5',
    marginBottom: 20,
  },
  goalCard: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  goalText: {
    fontSize: 14,
    color: '#d1d5db',
  },
  progressBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  statCard: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: 14,
    color: '#e5e7eb',
    marginTop: 4,
  },
});
