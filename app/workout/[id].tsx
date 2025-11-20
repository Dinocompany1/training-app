import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useWorkouts } from '../context/WorkoutsContext';

export default function WorkoutDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workouts } = useWorkouts();

  const workout = workouts.find((w) => w.id === id);

  if (!workout) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <View style={styles.container}>
          <Text style={styles.title}>Pass hittades inte</Text>
          <Text style={styles.text}>
            Kunde inte hitta träningspasset. Prova gå tillbaka till hemsidan.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Tillbaka</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.date}>{workout.date}</Text>
        <Text style={styles.title}>{workout.title}</Text>
        {workout.notes ? (
          <Text style={styles.notes}>{workout.notes}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>
          Övningar ({workout.exercises.length})
        </Text>

        {workout.exercises.map((ex) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{ex.name}</Text>
            <Text style={styles.exerciseDetails}>
              {ex.sets} set · {ex.reps} reps
              {ex.weight ? ` · ${ex.weight} kg` : ''}
            </Text>
          </View>
        ))}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Tillbaka</Text>
        </TouchableOpacity>
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
  date: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 10,
    marginTop: 10,
  },
  exerciseCard: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginBottom: 8,
  },
  exerciseName: {
    color: '#f9fafb',
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseDetails: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  text: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 16,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '500',
  },
});
