// app/(tabs)/add-workout.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  Dumbbell,
  PlusCircle,
  ListChecks,
  Flame,
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
import { useTranslation } from '../../context/TranslationContext';

export default function AddWorkoutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const actionBoxes = [
    {
      key: 'routine',
      title: t('add.actions.routine.title'),
      desc: t('add.actions.routine.desc'),
      icon: <PlusCircle size={18} color={colors.accentBlue} />,
      onPress: () => router.push('/routine-builder'),
    },
    {
      key: 'templates',
      title: t('add.actions.templates.title'),
      desc: t('add.actions.templates.desc'),
      icon: <ListChecks size={18} color={colors.primary} />,
      onPress: () => router.push('/templates'),
    },
    {
      key: 'schedule',
      title: t('add.actions.schedule.title'),
      desc: t('add.actions.schedule.desc'),
      icon: <CalendarClock size={18} color={colors.accentPurple} />,
      onPress: () => router.push('/schedule-workout'),
    },
    {
      key: 'library',
      title: t('add.actions.library.title'),
      desc: t('add.actions.library.desc'),
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
          <Text style={styles.title}>{t('add.title')}</Text>
          <Text style={styles.subtitle}>
            {t('add.subtitle')}
          </Text>

          {/* STARTA PASS NU */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Flame size={18} color={colors.accentGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t('add.quickTitle')}</Text>
                <Text style={styles.cardText}>
                  {t('add.quickDesc')}
                </Text>
              </View>
            </View>

            <NeonButton
              title={t('add.quickCta')}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/workout/quick-workout');
              }}
              style={{
                marginTop: 4,
                shadowOpacity: 0.12,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              }}
              variant="green"
              accessibilityLabel={t('add.quickA11y')}
              toastMessage={t('add.quickToast')}
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
  spotlight: {
    ...StyleSheet.absoluteFillObject,
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
