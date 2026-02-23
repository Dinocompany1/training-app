import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowRight, CalendarClock, Dumbbell, PlusCircle } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../../components/ui/GlassCard';
import AppButton from '../../components/ui/AppButton';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, gradients, typography, uiTones } from '../../constants/theme';
import { useTranslation } from '../../context/TranslationContext';
import { useWorkouts } from '../../context/WorkoutsContext';
import { sortWorkoutsByRecencyDesc } from '../../utils/workoutRecency';

export default function AddWorkoutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { templates, workouts } = useWorkouts();

  const actionBoxes = [
    {
      key: 'routine',
      title: t('add.actions.routine.title'),
      desc: t('add.actions.routine.desc'),
      icon: <PlusCircle size={17} color={colors.textMain} />,
      onPress: () => router.push('/routine-builder'),
    },
    {
      key: 'schedule',
      title: t('add.actions.schedule.title'),
      desc: t('add.actions.schedule.desc'),
      icon: <CalendarClock size={17} color={colors.textMain} />,
      onPress: () => router.push('/schedule-workout'),
    },
    {
      key: 'library',
      title: t('add.actions.library.title'),
      desc: t('add.actions.library.desc'),
      icon: <Dumbbell size={17} color={colors.textMain} />,
      onPress: () => router.push('/all-exercises'),
    },
  ];

  const latestTemplate = useMemo(() => {
    const completed = workouts.filter((w) => w.isCompleted && w.sourceTemplateId);
    if (completed.length === 0) return null;
    const latest = sortWorkoutsByRecencyDesc(completed)[0];
    if (!latest?.sourceTemplateId) return null;
    return templates.find((tpl) => tpl.id === latest.sourceTemplateId) || null;
  }, [templates, workouts]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={styles.full}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.heroCard} elevated={false} tone="green">
            <ScreenHeader
              kicker={t('add.heroKicker')}
              title={t('add.title')}
              subtitle={t('add.subtitle')}
              tone="green"
            />
            <AppButton
              title={t('add.quickCta')}
              variant="success"
              accessibilityLabel={t('add.quickA11y')}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/workout/quick-workout');
              }}
              style={styles.primaryCTA}
            />
          </GlassCard>

          {latestTemplate ? (
            <GlassCard style={styles.latestCard} elevated={false} tone="blue">
              <View style={styles.latestHeader}>
                <View style={[styles.dot, { backgroundColor: latestTemplate.color || colors.primary }]} />
                <Text style={styles.latestTitle}>{t('add.latestTitle')}</Text>
              </View>
              <Text style={styles.latestName}>{latestTemplate.name}</Text>
              <Text style={styles.latestMeta}>
                {t('add.latestMeta', undefined, latestTemplate.exercises?.length || 0)}
              </Text>
              <View style={styles.latestActions}>
                <AppButton
                  title={t('templates.start')}
                  variant="success"
                  style={styles.latestActionBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/workout/quick-workout',
                      params: {
                        templateId: latestTemplate.id,
                        title: latestTemplate.name,
                        color: latestTemplate.color,
                      },
                    });
                  }}
                />
                <AppButton
                  title={t('add.openTemplates')}
                  variant="secondary"
                  style={styles.latestActionBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/templates');
                  }}
                />
              </View>
            </GlassCard>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('add.sectionTitle')}</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/templates');
              }}
              style={styles.sectionLink}
            >
              <Text style={styles.sectionLinkText}>{t('add.actions.templates.title')}</Text>
              <ArrowRight size={14} color={colors.textSoft} />
            </TouchableOpacity>
          </View>

          <View style={styles.boxList}>
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
                <View style={styles.actionTop}>
                  <View style={styles.actionIconCircle}>{box.icon}</View>
                  <ArrowRight size={15} color={colors.textSoft} />
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
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: uiTones.green.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 12,
  },
  heroKicker: {
    ...typography.micro,
    color: '#93c5fd',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    ...typography.display,
    color: colors.textMain,
    fontSize: 26,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
    marginBottom: 12,
  },
  primaryCTA: {
    marginTop: 2,
  },
  latestCard: {
    marginBottom: 12,
    borderRadius: 16,
  },
  latestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  latestTitle: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  latestName: {
    ...typography.title,
    color: colors.textMain,
    marginTop: 6,
    fontSize: 18,
  },
  latestMeta: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
  },
  latestActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  latestActionBtn: {
    flex: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '800',
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionLinkText: {
    ...typography.micro,
    color: colors.textSoft,
    fontWeight: '700',
  },
  boxList: {
    gap: 10,
  },
  actionBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    minHeight: 104,
  },
  actionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginTop: 10,
  },
  actionText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 3,
  },
});
