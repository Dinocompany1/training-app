import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BackPill from '../components/ui/BackPill';
import GlassCard from '../components/ui/GlassCard';
import ScreenHeader from '../components/ui/ScreenHeader';
import { colors, gradients, inputs, spacing, typography } from '../constants/theme';
import { useTranslation } from '../context/TranslationContext';
import { AICoachProfile, loadAICoachProfile, saveAICoachProfile } from '../utils/aiCoachProfile';
import { toast } from '../utils/toast';

const MAX_FIELD_LENGTH = 260;

export default function AICoachProfileScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<
    'goal' | 'focus' | 'limitations' | 'schedule' | 'preferences' | null
  >(null);
  const [profile, setProfile] = useState<AICoachProfile>({
    goal: '',
    focusExercises: '',
    limitations: '',
    schedule: '',
    preferences: '',
  });

  useEffect(() => {
    const run = async () => {
      const loaded = await loadAICoachProfile();
      setProfile(loaded);
      setLoading(false);
    };
    void run();
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveAICoachProfile(profile);
      toast(`${t('aiCoach.profileSavedTitle')} - ${t('aiCoach.profileSavedBody')}`);
    } catch {
      toast(`${t('common.error')}: ${t('aiCoach.profileSaveFailed')}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={gradients.appBackground as any} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <BackPill />
          <ScreenHeader
            title={t('aiCoach.profileTitle')}
            subtitle={t('aiCoach.profileSubtitle')}
            compact
            tone="violet"
            style={styles.headerText}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <GlassCard style={styles.card} elevated={false}>
            <Text style={styles.cardHint}>{t('aiCoach.profileHint')}</Text>

            <Text style={styles.label}>{t('aiCoach.profileGoalLabel')}</Text>
            <TextInput
              value={profile.goal}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, goal: value.slice(0, MAX_FIELD_LENGTH) }))}
              onFocus={() => setFocusedField('goal')}
              onBlur={() => setFocusedField(null)}
              placeholder={t('aiCoach.profileGoalPlaceholder')}
              placeholderTextColor={colors.textSoft}
              style={[styles.input, focusedField === 'goal' ? styles.inputFocused : null]}
            />

            <Text style={styles.label}>{t('aiCoach.profileFocusLabel')}</Text>
            <TextInput
              value={profile.focusExercises}
              onChangeText={(value) =>
                setProfile((prev) => ({ ...prev, focusExercises: value.slice(0, MAX_FIELD_LENGTH) }))
              }
              onFocus={() => setFocusedField('focus')}
              onBlur={() => setFocusedField(null)}
              placeholder={t('aiCoach.profileFocusPlaceholder')}
              placeholderTextColor={colors.textSoft}
              style={[styles.input, focusedField === 'focus' ? styles.inputFocused : null]}
            />

            <Text style={styles.label}>{t('aiCoach.profileLimitationsLabel')}</Text>
            <TextInput
              value={profile.limitations}
              onChangeText={(value) =>
                setProfile((prev) => ({ ...prev, limitations: value.slice(0, MAX_FIELD_LENGTH) }))
              }
              onFocus={() => setFocusedField('limitations')}
              onBlur={() => setFocusedField(null)}
              placeholder={t('aiCoach.profileLimitationsPlaceholder')}
              placeholderTextColor={colors.textSoft}
              style={[
                styles.input,
                styles.multiline,
                focusedField === 'limitations' ? styles.inputFocused : null,
              ]}
              multiline
            />

            <Text style={styles.label}>{t('aiCoach.profileScheduleLabel')}</Text>
            <TextInput
              value={profile.schedule}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, schedule: value.slice(0, MAX_FIELD_LENGTH) }))}
              onFocus={() => setFocusedField('schedule')}
              onBlur={() => setFocusedField(null)}
              placeholder={t('aiCoach.profileSchedulePlaceholder')}
              placeholderTextColor={colors.textSoft}
              style={[styles.input, focusedField === 'schedule' ? styles.inputFocused : null]}
            />

            <Text style={styles.label}>{t('aiCoach.profilePreferencesLabel')}</Text>
            <TextInput
              value={profile.preferences}
              onChangeText={(value) =>
                setProfile((prev) => ({ ...prev, preferences: value.slice(0, MAX_FIELD_LENGTH) }))
              }
              onFocus={() => setFocusedField('preferences')}
              onBlur={() => setFocusedField(null)}
              placeholder={t('aiCoach.profilePreferencesPlaceholder')}
              placeholderTextColor={colors.textSoft}
              style={[
                styles.input,
                styles.multiline,
                focusedField === 'preferences' ? styles.inputFocused : null,
              ]}
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving || loading ? styles.saveDisabled : null]}
              onPress={() => {
                void save();
              }}
              disabled={saving || loading}
              activeOpacity={0.86}
            >
              <Text style={styles.saveText}>
                {loading ? t('aiCoach.loading') : saving ? t('common.save') : t('common.save')}
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: {
    ...typography.title,
    color: colors.textMain,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSoft,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: 18,
  },
  cardHint: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    minHeight: inputs.height,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    backgroundColor: '#0b1222',
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    ...typography.body,
  },
  inputFocused: {
    borderColor: '#a78bfa',
    shadowColor: '#a78bfa',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  multiline: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: spacing.lg,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    borderWidth: 1,
    borderColor: '#ffffff2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: 0.65,
  },
  saveText: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontWeight: '700',
  },
});
