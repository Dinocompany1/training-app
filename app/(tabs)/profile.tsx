import React, { useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useWorkouts } from '../../context/WorkoutsContext';

export default function ProfileScreen() {
  const { weeklyGoal, setWeeklyGoal } = useWorkouts();
  const [localGoal, setLocalGoal] = useState(
    weeklyGoal > 0 ? String(weeklyGoal) : ''
  );

  const handleSaveGoal = () => {
    const parsed = parseInt(localGoal, 10);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert('Fel', 'Ange ett giltigt tal (0 eller högre).');
      return;
    }
    setWeeklyGoal(parsed);
    Keyboard.dismiss(); // 🔥 stäng tangentbordet
    Alert.alert('Sparat', 'Ditt veckomål har uppdaterats.');
  };

  const handleQuickSet = (goal: number) => {
    setLocalGoal(String(goal));
    setWeeklyGoal(goal);
    Keyboard.dismiss(); // 🔥 stäng tangentbordet
    Alert.alert('Sparat', `Veckomål uppdaterat till ${goal} pass.`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <Text style={styles.title}>Profil & mål</Text>
            <Text style={styles.subtitle}>
              Justera ditt veckomål för hur många pass du vill köra.
            </Text>

            <Text style={styles.label}>Veckomål (antal pass)</Text>
            <TextInput
              style={styles.input}
              placeholder="T.ex. 3"
              placeholderTextColor="#6b7280"
              keyboardType="number-pad"
              value={localGoal}
              onChangeText={setLocalGoal}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoal}>
              <Text style={styles.saveButtonText}>Spara veckomål</Text>
            </TouchableOpacity>

            <Text style={styles.quickLabel}>Snabbval</Text>
            <View style={styles.quickRow}>
              {[2, 3, 4, 5].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.quickButton,
                    weeklyGoal === g && styles.quickButtonActive,
                  ]}
                  onPress={() => handleQuickSet(g)}
                >
                  <Text
                    style={[
                      styles.quickButtonText,
                      weeklyGoal === g && styles.quickButtonTextActive,
                    ]}
                  >
                    {g} pass
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.currentBox}>
              <Text style={styles.currentText}>
                Nuvarande mål:{' '}
                <Text style={styles.currentValue}>
                  {weeklyGoal > 0
                    ? `${weeklyGoal} pass / vecka`
                    : 'Inget mål satt'}
                </Text>
              </Text>
            </View>

            <Text style={styles.infoText}>
              Tips: Ändra målet här, och kolla sedan Hem och Statistik för att se
              hur nära du är ditt mål den här veckan.
            </Text>
          </View>
        </TouchableWithoutFeedback>
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
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  label: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 15,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#02131b',
    fontSize: 16,
    fontWeight: '700',
  },
  quickLabel: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  quickButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  quickButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '500',
  },
  quickButtonTextActive: {
    color: '#02131b',
    fontWeight: '700',
  },
  currentBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  currentText: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  currentValue: {
    fontWeight: '700',
    color: '#22c55e',
  },
  infoText: {
    marginTop: 12,
    fontSize: 12,
    color: '#9ca3af',
  },
});
