import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useWorkouts, Workout } from '../../context/WorkoutsContext';

type GroupedWorkouts = {
  [date: string]: Workout[];
};

export default function CalendarScreen() {
  const { workouts } = useWorkouts();
  const router = useRouter();

  // Gruppera pass per datum
  const groupedByDate = useMemo(() => {
    const groups: GroupedWorkouts = {};
    workouts.forEach((w) => {
      if (!groups[w.date]) {
        groups[w.date] = [];
      }
      groups[w.date].push(w);
    });

    // Sortera datumen (senaste först)
    const sortedDates = Object.keys(groups).sort((a, b) =>
      a < b ? 1 : -1
    );

    return { groups, sortedDates };
  }, [workouts]);

  const { groups, sortedDates } = groupedByDate;

  const handleOpenDetails = (id: string) => {
    router.push(`/workout/${id}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Kalender</Text>
        <Text style={styles.subtitle}>
          Här ser du dina pass sorterade per datum. Tryck på ett pass för detaljer.
        </Text>

        {sortedDates.length === 0 && (
          <Text style={styles.emptyText}>
            Du har inte loggat några pass ännu. Lägg till ditt första pass via &quot;Lägg till&quot;-fliken.
          </Text>
        )}

        {sortedDates.map((date) => (
          <View key={date} style={styles.dateSection}>
            <Text style={styles.dateHeading}>{date}</Text>
            {groups[date].map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.workoutCard}
                onPress={() => handleOpenDetails(w.id)}
              >
                <Text style={styles.workoutTitle}>{w.title}</Text>
                {w.notes ? (
                  <Text style={styles.workoutNotes} numberOfLines={1}>
                    {w.notes}
                  </Text>
                ) : null}
                <Text style={styles.workoutMeta}>
                  {w.exercises.length} övning
                  {w.exercises.length === 1 ? '' : 'ar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
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
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  dateSection: {
    marginTop: 16,
  },
  dateHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  workoutCard: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 10,
    marginBottom: 8,
  },
  workoutTitle: {
    color: '#f9fafb',
    fontSize: 15,
    fontWeight: '600',
  },
  workoutNotes: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  workoutMeta: {
    color: '#a5b4fc',
    fontSize: 12,
    marginTop: 4,
  },
});
