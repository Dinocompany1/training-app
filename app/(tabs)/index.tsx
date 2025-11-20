import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useWorkouts, Workout } from '../context/WorkoutsContext';

export default function HomeScreen() {
  const router = useRouter();
  const { workouts } = useWorkouts();

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
      <Text style={styles.workoutNotes}>{item.notes}</Text>
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
        <Text style={styles.appTitle}>Min träningslogg</Text>
        <Text style={styles.subtitle}>
          Tryck på ett pass för att se alla övningar.
        </Text>

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
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5f5',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
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
    marginTop: 6,
  },
  tapHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
});
