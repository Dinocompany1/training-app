// app/(tabs)/add-workout.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  Dumbbell,
  Play,
  PlusCircle,
  ListChecks,
} from 'lucide-react-native';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import NeonButton from '../../components/ui/NeonButton';
import { colors, gradients, typography } from '../../constants/theme';

export default function AddWorkoutScreen() {
  const router = useRouter();
  const actionBoxes = [
    {
      key: 'routine',
      title: 'Skapa rutin',
      desc: 'Bygg ett återanvändbart pass med dina favoritövningar.',
      icon: <PlusCircle size={18} color={colors.accentBlue} />,
      onPress: () => router.push('/routine-builder'),
    },
    {
      key: 'templates',
      title: 'Sparade rutiner',
      desc: 'Starta ett pass direkt från dina mallar.',
      icon: <ListChecks size={18} color={colors.primary} />,
      onPress: () => router.push('/templates'),
    },
    {
      key: 'schedule',
      title: 'Planera framtida pass',
      desc: 'Välj datum så dyker passet upp i kalendern.',
      icon: <CalendarClock size={18} color={colors.accentPurple} />,
      onPress: () => router.push('/schedule-workout'),
    },
    {
      key: 'library',
      title: 'Se alla övningar',
      desc: 'Bläddra bland alla övningar per muskelgrupp.',
      icon: <Dumbbell size={18} color={colors.accentGreen} />,
      onPress: () => router.push('/all-exercises'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={styles.full}>
        <View style={styles.spotlight} />
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Lägg till pass</Text>
          <Text style={styles.subtitle}>
            Bygg, planera eller starta direkt – snabba vägar med neon-känsla.
          </Text>

          {/* STARTA PASS NU */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Play size={18} color={colors.accentGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Starta spontanpass</Text>
                <Text style={styles.cardText}>
                  Logga ett spontant pass som du kör direkt på gymmet.
                </Text>
              </View>
            </View>

            <NeonButton
              title="🚀 Starta spontanpass"
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/workout/quick-workout');
              }}
              style={{ marginTop: 4 }}
              variant="green"
              accessibilityLabel="Starta ett snabbt pass nu"
              accessibilityRole="button"
              toastMessage="Startar snabbt pass"
            />
          </GlassCard>

          {/* Snabbval i boxar */}
          <View style={styles.boxGrid}>
            {actionBoxes.map((box) => (
              <TouchableOpacity
                key={box.key}
                style={styles.actionBox}
                activeOpacity={0.92}
                onPress={() => {
                  Haptics.selectionAsync();
                  box.onPress();
                }}
                accessibilityLabel={box.title}
                accessibilityRole="button"
              >
                <View style={[styles.iconCircle, styles.actionIconCircle]}>
                  {box.icon}
                </View>
                <Text style={styles.actionTitle}>{box.title}</Text>
                <Text style={styles.actionText}>{box.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  full: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
    marginBottom: 12,
  },
  card: {
    marginTop: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
  },
  button: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accentGreen,
  },
  secondaryButton: {
    backgroundColor: colors.accentBlue,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  boxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  actionBox: {
    width: '48%',
    backgroundColor: '#0b1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111827',
    padding: 12,
    minHeight: 130,
    justifyContent: 'space-between',
  },
  actionIconCircle: {
    alignSelf: 'flex-start',
  },
  actionTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 8,
  },
  actionText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
  },
  buttonText: {
    ...typography.bodyBold,
    color: 'white',
  },
});
