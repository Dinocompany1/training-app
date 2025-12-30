// app/templates.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Play, Trash2 } from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../components/ui/GlassCard';
import NeonButton from '../components/ui/NeonButton';
import { colors, gradients, typography } from '../constants/theme';
import { Template, useWorkouts } from '../context/WorkoutsContext';
import { toast } from '../utils/toast';
import { useTranslation } from '../context/TranslationContext';

export default function TemplatesScreen() {
  const { templates, removeTemplate, addTemplate } = useWorkouts();
  const router = useRouter();
  const { t } = useTranslation();

  const handleDelete = (template: Template) => {
    Alert.alert(
      t('templates.deleteTitle'),
      t('templates.deleteConfirm', template.name),
      [
        { text: t('templates.cancel'), style: 'cancel' },
        {
          text: t('templates.delete'),
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            removeTemplate(template.id);
            toast(t('templates.deletedToast'));
            Alert.alert(t('templates.deletedTitle'), t('templates.deletedBody'), [
              {
                text: t('templates.undo'),
                style: 'default',
                onPress: () => {
                  Haptics.selectionAsync();
                  addTemplate(template);
                },
              },
              { text: t('templates.ok'), style: 'default' },
            ]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={gradients.appBackground} style={styles.full}>
        <View style={styles.spotlight} />
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>{t('templates.title')}</Text>
              <Text style={styles.subtitle}>
                {t('templates.subtitle')}
              </Text>
              <NeonButton
                title={t('templates.createCta')}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/routine-builder');
                }}
                style={{ marginTop: 8 }}
                toastMessage={t('templates.createToast')}
              />
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>
                    {t('templates.metaExercises', item.exercises.length)}
                    {item.description ? ` · ${item.description}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  accessibilityLabel={t('templates.removeA11y', item.name)}
                  accessibilityRole="button"
                >
                  <Trash2 size={18} color="#fca5a5" />
                </TouchableOpacity>
              </View>
              <View style={styles.exerciseRow}>
                {item.exercises.slice(0, 3).map((ex) => (
                  <Text key={ex.name} style={styles.exerciseTag}>
                    {ex.name}
                  </Text>
                ))}
                {item.exercises.length > 3 && (
                  <Text style={styles.exerciseTag}>
                    {t('templates.moreCount', item.exercises.length - 3)}
                  </Text>
                )}
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionChip, styles.primaryChip]}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push({
                      pathname: '/workout/quick-workout',
                      params: {
                        title: item.name,
                        color: item.color,
                        templateId: item.id,
                      },
                    });
                  }}
                >
                  <Play size={16} color="#022c22" />
                  <Text style={styles.primaryText}>{t('templates.start')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionChip, styles.secondaryChip]}
                  activeOpacity={0.9}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/routine-builder');
                  }}
                >
                  <Text style={styles.secondaryText}>{t('templates.newRoutine')}</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        ListFooterComponent={<View style={{ height: 40 }} />}
        showsVerticalScrollIndicator={false}
      />
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
    position: 'absolute',
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 300,
    backgroundColor: '#a855f733',
    opacity: 0.35,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    ...typography.display,
    fontSize: 22,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 4,
  },
  card: {
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
  },
  exerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  exerciseTag: {
    backgroundColor: '#0b1220',
    color: colors.textSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  primaryChip: {
    backgroundColor: colors.success, // Starta pass: grön
    borderColor: colors.success,
    flex: 1,
    justifyContent: 'center',
  },
  secondaryChip: {
    backgroundColor: colors.primary, // Planera pass: lila
    borderColor: colors.primary,
  },
  primaryText: {
    ...typography.bodyBold,
    color: '#022c22',
  },
  secondaryText: {
    ...typography.bodyBold,
    color: '#0b1120',
  },
  emptyCard: {
    marginTop: 10,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textMain,
    marginBottom: 4,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
});
