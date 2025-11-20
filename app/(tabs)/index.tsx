import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
    FlatList,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useWorkouts, Workout } from '../../context/WorkoutsContext';

export default function HomeScreen() {
  const router = useRouter();
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

  const handleOpenDetails = (id: string) => {
    router.push(`/workout/${id}`);
  };

  const renderWorkout = ({ item }: { item: Workout }) => (
    <TouchableOpacity
      onPress={() => handleOpenDetails(item.id)}
      style={styles.workoutCard}
    >
      <Text style={styles.workoutDate}>{item.date}</Text>
      <Text style={styles.workoutTitle}>{item.title}</Text>
      {item.notes ? (
        <Text style={styles.workoutNotes} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
      <Text style={styles.workoutExercises}>
        {item.exercises.length} övning{item.exercises.length === 1 ? '' : 'ar'}
      </Text>
      <Text style={styles.tapHint}>Tryck för detaljer</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.appTitle}>Din träningsöversikt</Text>
        <Text style={styles.subtitle}>
          Här ser du en snabb överblick av din vecka och dina senaste pass.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{thisWeekPass}</Text>
            <Text style={styles.statLabel}>Den här veckan</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{lastWeekPass}</Text>
            <Text style={styles.statLabel}>Förra veckan</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalPass}</Text>
            <Text style={styles.statLabel}>Totalt</Text>
          </View>
        </View>

        {weeklyGoal > 0 ? (
          <Text style={styles.goalText}>
            Veckomål: {weeklyGoal} pass · Den här veckan: {thisWeekPass}/{weeklyGoal}
          </Text>
        ) : (
          <Text style={styles.goalText}>
            Inget veckomål satt. Gå till Profil för att lägga till ett.
          </Text>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/add-workout')}
        >
          <Text style={styles.addButtonText}>+ Lägg till träningspass</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Senaste pass</Text>

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={renderWorkout}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#050816',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#cbd5f5',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: 11,
    color: '#e5e7eb',
    marginTop: 2,
    textAlign: 'center',
  },
  goalText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  addButtonText: {
    color: '#02131b',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    color: '#e5e7eb',
    fontWeight: '600',
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  workoutCard: {
    backgroundColor: '#0b1220',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  workoutDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  workoutTitle: {
    fontSize: 16,
    color: '#f9fafb',
    fontWeight: '600',
  },
  workoutNotes: {
    fontSize: 13,
    color: '#d1d5db',
    marginTop: 4,
  },
  workoutExercises: {
    fontSize: 12,
    color: '#a5b4fc',
    marginTop: 4,
  },
  tapHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
});
