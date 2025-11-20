import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Exercise, useWorkouts } from '../context/WorkoutsContext';

export default function AddWorkoutScreen() {
  const router = useRouter();
  const { addWorkout } = useWorkouts();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const [exerciseName, setExerciseName] = useState('');
  const [exerciseSets, setExerciseSets] = useState('');
  const [exerciseReps, setExerciseReps] = useState('');
  const [exerciseWeight, setExerciseWeight] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const handleAddExercise = () => {
    if (!exerciseName || !exerciseSets || !exerciseReps) {
      Alert.alert('Fel', 'Fyll i minst namn, set och reps för övningen.');
      return;
    }

    const newExercise: Exercise = {
      id: Date.now().toString() + Math.random().toString(),
      name: exerciseName,
      sets: exerciseSets,
      reps: exerciseReps,
      weight: exerciseWeight || undefined,
    };

    setExercises((prev) => [...prev, newExercise]);

    setExerciseName('');
    setExerciseSets('');
    setExerciseReps('');
    setExerciseWeight('');
  };

  const handleSave = () => {
    if (!title || !date) {
      Alert.alert('Fel', 'Fyll i minst namn på passet och datum.');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Obs', 'Du har inte lagt till några övningar än.');
      // vi kan välja att avbryta här eller tillåta spar ändå
      // return;
    }

    addWorkout({
      title,
      date,
      notes,
      exercises,
    });

    Alert.alert('Sparat', 'Ditt träningspass sparades (i appen).');

    setTitle('');
    setDate('');
    setNotes('');
    setExercises([]);

    router.push('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Lägg till träningspass</Text>

          <Text style={styles.label}>Namn på pass</Text>
          <TextInput
            style={styles.input}
            placeholder="T.ex. Push, Ben, Helkropp..."
            placeholderTextColor="#6b7280"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Datum</Text>
          <TextInput
            style={styles.input}
            placeholder="ÅÅÅÅ-MM-DD (t.ex. 2025-11-20)"
            placeholderTextColor="#6b7280"
            value={date}
            onChangeText={setDate}
          />

          <Text style={styles.label}>Anteckningar</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Övningar, känsla, vikt osv..."
            placeholderTextColor="#6b7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitle}>Övningar i passet</Text>

          <Text style={styles.label}>Övningens namn</Text>
          <TextInput
            style={styles.input}
            placeholder="T.ex. Bänkpress"
            placeholderTextColor="#6b7280"
            value={exerciseName}
            onChangeText={setExerciseName}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.labelSmall}>Set</Text>
              <TextInput
                style={styles.input}
                placeholder="3"
                placeholderTextColor="#6b7280"
                value={exerciseSets}
                onChangeText={setExerciseSets}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.labelSmall}>Reps</Text>
              <TextInput
                style={styles.input}
                placeholder="8–10"
                placeholderTextColor="#6b7280"
                value={exerciseReps}
                onChangeText={setExerciseReps}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.labelSmall}>Vikt (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="60"
                placeholderTextColor="#6b7280"
                value={exerciseWeight}
                onChangeText={setExerciseWeight}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.addExerciseButton} onPress={handleAddExercise}>
            <Text style={styles.addExerciseButtonText}>+ Lägg till övning</Text>
          </TouchableOpacity>

          {exercises.length > 0 && (
            <View style={styles.exerciseList}>
              {exercises.map((ex) => (
                <View key={ex.id} style={styles.exerciseItem}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseDetails}>
                    {ex.sets} set · {ex.reps} reps{ex.weight ? ` · ${ex.weight} kg` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Spara pass</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Avbryt</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 6,
    marginTop: 12,
  },
  labelSmall: {
    fontSize: 12,
    color: '#e5e7eb',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f9fafb',
    fontSize: 15,
  },
  multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rowItem: {
    flex: 1,
  },
  addExerciseButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  addExerciseButtonText: {
    color: '#e5f3ff',
    fontSize: 15,
    fontWeight: '600',
  },
  exerciseList: {
    marginTop: 16,
    marginBottom: 10,
    gap: 8,
  },
  exerciseItem: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 10,
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
  saveButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#02131b',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
