import React, { useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useWorkouts } from '../context/WorkoutsContext';

export default function StatsScreen() {
  const { workouts } = useWorkouts();

  // Helper för att få YYYY-MM-DD
  const today = new Date();
  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7);
  };

  // Veckonummer idag
  const thisWeek = getWeekNumber(today);
  const thisYear = today.getFullYear();

  // Räkna statistik
  const { totalPass, thisWeekPass, lastWeekPass } = useMemo(() => {
    let total = workouts.length;

    let weekThis = 0;
    let weekLast = 0;

    workouts.forEach((w) => {
      const d = new Date(w.date);
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Statistik</Text>
        <Text style={styles.subtitle}>
          Överblick på din träning baserat på pass du loggat.
        </Text>

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
