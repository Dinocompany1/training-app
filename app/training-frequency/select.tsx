// app/training-frequency/select.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import { colors, gradients, typography } from '../../constants/theme';
import { useWorkouts } from '../../context/WorkoutsContext';
import { useTranslation } from '../../context/TranslationContext';
import BackPill from '../../components/ui/BackPill';

export default function TrainingFrequencySelectScreen() {
  const { workouts } = useWorkouts();
  const { t } = useTranslation();
  const router = useRouter();

  const exercises = useMemo(() => {
    const names = new Set<string>();
    workouts
      .filter((w) => w.isCompleted)
      .forEach((w) => (w.exercises || []).forEach((ex) => ex.name && names.add(ex.name)));
    return Array.from(names).sort();
  }, [workouts]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backRow}>
          <BackPill onPress={() => router.replace('/training-frequency')} />
        </View>
        <Text style={styles.title}>{t('stats.freqSelectTitle', 'Välj övning')}</Text>
        <Text style={styles.subtitle}>{t('stats.freqSelectSub', 'Vilken övning vill du se träningsfrekvens för?')}</Text>

        <GlassCard style={styles.card} elevated={false}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.replace('/training-frequency')}
            accessibilityRole="button"
            accessibilityLabel={t('stats.filters.all', 'Alla övningar')}
          >
            <Text style={styles.name}>{t('stats.filters.all', 'Alla övningar')}</Text>
          </TouchableOpacity>
        </GlassCard>

        {exercises.map((ex) => (
          <GlassCard key={ex} style={styles.card} elevated={false}>
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                router.replace({ pathname: '/training-frequency', params: { exercise: ex } })
              }
              accessibilityRole="button"
              accessibilityLabel={ex}
            >
              <Text style={styles.name}>{ex}</Text>
            </TouchableOpacity>
          </GlassCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backRow: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
    marginBottom: 10,
  },
  card: {
    marginTop: 8,
  },
  row: {
    paddingVertical: 10,
  },
  name: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
});
