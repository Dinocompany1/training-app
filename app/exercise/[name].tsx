// app/exercise/[name].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useWorkouts } from '../../context/WorkoutsContext';

export default function ExerciseProgressScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { workouts } = useWorkouts();

  const history = workouts
    .flatMap((w) =>
      (w.exercises ?? [])
        .filter((ex) => ex.name.toLowerCase() === name.toLowerCase())
        .flatMap((ex) => {
          const performed = ex.performedSets && ex.performedSets.length > 0
            ? ex.performedSets
            : Array.from({ length: ex.sets }).map(() => ({
                reps: ex.reps,
                weight: ex.weight,
              }));

          return performed.map((set, idx) => ({
            date: w.date,
            title: w.title,
            setNumber: idx + 1,
            reps: set.reps,
            weight: set.weight,
            done: set.done,
            volume: (Number(set.reps) || 0) * (set.weight || 0),
          }));
        })
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>{name}</Text>

      {history.length === 0 ? (
        <Text style={styles.empty}>
          Inga loggar hittades för denna övning ännu.
        </Text>
      ) : (
        history.map((h, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.date}>{h.date}</Text>
            <Text style={styles.passTitle}>{h.title}</Text>
            <Text style={styles.setLabel}>Set {h.setNumber}</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Reps:</Text>
              <Text style={styles.value}>{h.reps}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Vikt:</Text>
              <Text style={styles.value}>{h.weight} kg</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Volym:</Text>
              <Text style={[styles.value, styles.volume]}>
                {h.volume}
              </Text>
            </View>

            {h.done && <Text style={styles.doneBadge}>Klart ✅</Text>}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    padding: 16,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
  },
  card: {
    backgroundColor: '#0b1220',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  date: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  passTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  setLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  label: {
    color: '#9ca3af',
    fontSize: 13,
  },
  value: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  volume: {
    color: '#38bdf8',
  },
  doneBadge: {
    marginTop: 4,
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '700',
  },
});
