// app/(tabs)/profile.tsx
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, User, Image as ImageIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GlassCard from '../../components/ui/GlassCard';
import BadgePill from '../../components/ui/BadgePill';
import ScreenHeader from '../../components/ui/ScreenHeader';
import StaggerReveal from '../../components/ui/StaggerReveal';
import { colors, gradients, inputs, layout, spacing, typography } from '../../constants/theme';
import EmptyState from '../../components/ui/EmptyState';
import { useWorkouts } from '../../context/WorkoutsContext';
import { toast } from '../../utils/toast';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTranslation } from '../../context/TranslationContext';
import { todayISO } from '../../utils/date';
import { createId } from '../../utils/id';
import { appConfig } from '../../utils/appConfig';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    weeklyGoal,
    setWeeklyGoal,
    workouts,
    addBodyPhoto,
    syncStatus,
    syncErrorMessage,
  } = useWorkouts();
  const { lang, setLanguage, t } = useTranslation();
  const [goalInput, setGoalInput] = useState(String(weeklyGoal));
  const [goalError, setGoalError] = useState('');
  const totalWorkouts = workouts.length;
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const [focusedInput, setFocusedInput] = useState<'goal' | 'note' | null>(null);
  const todayStr = todayISO();
  const updateGoalBy = (delta: number) => {
    const current = Number(goalInput.replace(/[^0-9]/g, '') || '0');
    const next = Math.max(0, Math.min(14, current + delta));
    setGoalError('');
    setGoalInput(String(next));
    setWeeklyGoal(next);
    Haptics.selectionAsync();
  };

  const openUrl = async (url: string | null) => {
    if (!url) {
      toast(t('profile.linkMissing'));
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      toast(t('profile.linkInvalid'));
      return;
    }
    await Linking.openURL(url);
  };

  const openSupportMail = async () => {
    if (!appConfig.supportEmail) {
      toast(t('profile.linkMissing'));
      return;
    }
    const mailto = `mailto:${appConfig.supportEmail}`;
    const supported = await Linking.canOpenURL(mailto);
    if (!supported) {
      toast(t('profile.linkInvalid'));
      return;
    }
    await Linking.openURL(mailto);
  };

  const handleGoalBlur = () => {
    const clean = goalInput.replace(/[^0-9]/g, '');
    if (!clean.trim()) {
      setGoalError(t('profile.goalError'));
      setGoalInput(String(weeklyGoal));
      return;
    }
    const n = Number(clean);
    const clamped = Math.max(0, Math.min(14, n));
    setGoalError('');
    setWeeklyGoal(clamped);
    setGoalInput(String(clamped));
  };

  const pickBodyPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(t('profile.permBody'));
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets || !res.assets[0]?.uri) {
      return null;
    }
    return res.assets[0].uri;
  };

  return (
    <View style={styles.gradient}>
      <LinearGradient
        colors={gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER / USER CARD */}
          <StaggerReveal delay={40}>
            <GlassCard style={styles.headerCard} tone="neutral">
            <View style={styles.headerRow}>
              <View style={styles.avatarCircle}>
                <User size={30} color="#e5e7eb" />
              </View>
              <ScreenHeader
                title={t('profile.title')}
                subtitle={t('profile.subtitle')}
                compact
                tone="neutral"
                style={styles.profileHeaderText}
              />
            </View>

            <View style={styles.langRow}>
              <Text style={styles.langLabel}>{t('profile.language')}</Text>
              <View style={styles.langButtons}>
                {[
                  { key: 'sv', label: t('profile.langSv') },
                  { key: 'en', label: t('profile.langEn') },
                ].map((item) => {
                  const active = lang === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[
                        styles.langButton,
                        active && styles.langButtonActive,
                      ]}
                      onPress={() => setLanguage(item.key as 'sv' | 'en')}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={item.label}
                    >
                      <Text
                        style={[
                          styles.langButtonText,
                          active && styles.langButtonTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.headerStatsRow}>
              <View style={styles.headerStatBox}>
                <Text style={styles.headerStatLabel}>{t('profile.totalWorkouts')}</Text>
                <Text style={styles.headerStatValue}>{totalWorkouts}</Text>
              </View>
              <View style={styles.headerStatBox}>
                <Text style={styles.headerStatLabel}>{t('profile.weeklyGoal')}</Text>
                <Text style={styles.headerStatValue}>
                  {weeklyGoal} / {t('profile.perWeek')}
                </Text>
              </View>
            </View>
            </GlassCard>
          </StaggerReveal>
          {syncStatus === 'error' && syncErrorMessage ? (
            <Text style={styles.syncErrorInline}>
              {t('profile.syncError')} {syncErrorMessage}
            </Text>
          ) : null}

          {/* MÅL / VECKOMÅL */}
          <StaggerReveal delay={90}>
            <GlassCard style={styles.card} tone="neutral">
            <View style={styles.cardTitleRow}>
              <Target size={20} color={colors.textSoft} />
              <Text style={styles.sectionTitle}>{t('profile.weeklyCardTitle')}</Text>
            </View>
            <Text style={styles.sectionSub}>
              {t('profile.weeklyCardSub')}
            </Text>

            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>{t('profile.goalLabel')}</Text>
              <View style={styles.goalInputRow}>
                <TouchableOpacity
                  style={styles.goalStepButton}
                  onPress={() => updateGoalBy(-1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.goalLabel')}
                >
                  <Text style={styles.goalStepText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  value={goalInput}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/[^0-9]/g, '').slice(0, 2);
                    setGoalError('');
                    setGoalInput(cleaned);
                    if (!cleaned.trim()) return;
                    const next = Math.max(0, Math.min(14, Number(cleaned)));
                    setWeeklyGoal(next);
                  }}
                  keyboardType="number-pad"
                  style={[styles.goalInput, focusedInput === 'goal' ? styles.inputFocused : null]}
                  onFocus={() => setFocusedInput('goal')}
                  onBlur={() => {
                    setFocusedInput(null);
                    handleGoalBlur();
                  }}
                  maxLength={2}
                  accessibilityLabel={t('profile.goalA11y')}
                  accessibilityRole="adjustable"
                />
                <Text style={styles.goalSuffix}>{t('profile.goalSuffix')}</Text>
                <TouchableOpacity
                  style={styles.goalStepButton}
                  onPress={() => updateGoalBy(1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.goalLabel')}
                >
                  <Text style={styles.goalStepText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.goalHint}>
              {t('profile.goalHint')}
            </Text>
            <BadgePill
              label={t('profile.goalBadge', undefined, totalWorkouts)}
              tone="primary"
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
            />
            {goalError ? (
              <Text style={styles.goalErrorText}>
                {goalError}
              </Text>
            ) : null}
            </GlassCard>
          </StaggerReveal>

          <StaggerReveal delay={140}>
            <GlassCard style={styles.card} tone="neutral">
            <View style={styles.cardTitleRow}>
              <Text style={styles.sectionTitle}>{t('profile.legalTitle')}</Text>
            </View>
            <Text style={styles.sectionSub}>{t('profile.legalSub')}</Text>
            <View style={styles.linkActions}>
              <TouchableOpacity
                style={[styles.pbEmptyButton, styles.secondaryButton]}
                onPress={() => openUrl(appConfig.privacyPolicyUrl)}
                accessibilityRole="button"
                accessibilityLabel={t('profile.privacyPolicy')}
              >
                <Text style={styles.pbEmptyButtonText}>{t('profile.privacyPolicy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pbEmptyButton, styles.secondaryButton]}
                onPress={() => openUrl(appConfig.termsUrl)}
                accessibilityRole="button"
                accessibilityLabel={t('profile.termsOfUse')}
              >
                <Text style={styles.pbEmptyButtonText}>{t('profile.termsOfUse')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pbEmptyButton, styles.secondaryButton]}
                onPress={openSupportMail}
                accessibilityRole="button"
                accessibilityLabel={t('profile.contactSupport')}
              >
                <Text style={styles.pbEmptyButtonText}>{t('profile.contactSupport')}</Text>
              </TouchableOpacity>
            </View>
            </GlassCard>
          </StaggerReveal>

          {/* KROPPSBILDER */}
          <StaggerReveal delay={190}>
            <GlassCard style={styles.card} tone="neutral">
            <View style={styles.cardTitleRow}>
              <ImageIcon size={20} color={colors.textSoft} />
              <Text style={styles.sectionTitle}>{t('profile.bodyPhotosTitle')}</Text>
            </View>
            <Text style={styles.sectionSub}>
              {t('profile.bodyPhotosSub')}
            </Text>
            <View style={styles.photoInputs}>
              {selectedUri ? (
                <>
                  <TouchableOpacity
                    style={[styles.pbEmptyButton, styles.primaryButton]}
                    onPress={async () => {
                      const uri = await pickBodyPhoto();
                      if (uri) {
                        setSelectedUri(uri);
                        toast(t('profile.photoPicked'));
                      }
                    }}
                  >
                    <Text style={styles.pbEmptyButtonText}>
                      {selectedUri ? t('profile.replacePhoto') : t('profile.addPhoto')}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.photoPreview}>
                    <Image
                      source={{ uri: selectedUri }}
                      style={styles.photoPreviewImage}
                      contentFit="cover"
                    />
                    <Text style={styles.photoPreviewMeta}>{t('profile.photoReady')}</Text>
                  </View>
                  <TextInput
                    value={photoNote}
                    onChangeText={setPhotoNote}
                    onFocus={() => setFocusedInput('note')}
                    onBlur={() => setFocusedInput(null)}
                    placeholder={t('profile.photoNotePlaceholder')}
                    placeholderTextColor={colors.textSoft}
                    style={[
                      styles.photoInput,
                      styles.photoNote,
                      focusedInput === 'note' ? styles.inputFocused : null,
                    ]}
                  />
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={[styles.pbEmptyButton, styles.primaryButton]}
                      onPress={() => {
                        if (!selectedUri) {
                          toast(t('profile.pickFirst'));
                          return;
                        }
                        const photo = {
                          id: createId('photo'),
                          uri: selectedUri,
                          date: todayStr,
                          note: photoNote.trim() || undefined,
                        };
                        addBodyPhoto(photo);
                        setSelectedUri(null);
                        setPhotoNote('');
                        toast(t('profile.photoSaved'));
                      }}
                    >
                      <Text style={styles.pbEmptyButtonText}>{t('profile.savePhoto')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pbEmptyButton, styles.secondaryButton]}
                      onPress={() => {
                        setSelectedUri(null);
                        setPhotoNote('');
                      }}
                    >
                      <Text style={styles.pbEmptyButtonText}>{t('profile.clear')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.photoActionsSingle}>
                    <TouchableOpacity
                      style={[styles.pbEmptyButton, styles.secondaryButton, styles.fullWidthButton]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push('/body-photos');
                      }}
                    >
                      <Text style={styles.pbEmptyButtonText}>{t('profile.openGallery')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <EmptyState
                  title={t('profile.emptyPhotosTitle')}
                  subtitle={t('profile.emptyPhotosSubtitle')}
                  ctaLabel={t('profile.emptyPhotosCta')}
                  onPressCta={async () => {
                    const uri = await pickBodyPhoto();
                    if (uri) {
                      setSelectedUri(uri);
                      toast(t('profile.photoPicked'));
                    }
                  }}
                />
              )}
              {!selectedUri && (
                <View style={[styles.photoActions, { marginTop: 4 }]}>
                  <TouchableOpacity
                    style={[styles.pbEmptyButton, styles.secondaryButton, styles.fullWidthButton]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/body-photos');
                    }}
                  >
                    <Text style={styles.pbEmptyButtonText}>{t('profile.openGallery')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            </GlassCard>
          </StaggerReveal>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  headerCard: {
    marginBottom: layout.sectionGapLg,
    borderRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  profileHeaderText: {
    flex: 1,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  langRow: {
    marginTop: 10,
    gap: 6,
  },
  langLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  langButtons: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 4,
  },
  langButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  langButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  langButtonText: {
    ...typography.caption,
    color: colors.textMain,
  },
  langButtonTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  headerStatBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerStatLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  headerStatValue: {
    ...typography.title,
    fontSize: 18,
    color: colors.textMain,
  },

  card: {
    marginBottom: layout.sectionGap,
    borderRadius: 18,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.textSoft,
    marginBottom: 10,
  },
  photoInputs: {
    gap: 8,
    marginTop: 4,
  },
  photoInput: {
    minHeight: inputs.height,
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    fontSize: 13,
  },
  inputFocused: {
    borderColor: colors.primaryBright,
    shadowColor: colors.primaryBright,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  photoNote: {
    minHeight: 50,
  },
  photoPreview: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoPreviewMeta: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    color: colors.textMain,
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoActionsSingle: {
    flexDirection: 'row',
    marginTop: 2,
  },
  pbEmptyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fullWidthButton: {
    flex: 1,
  },
  pbEmptyButtonText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: colors.cardBorder,
  },

  goalRow: {
    marginTop: 2,
    marginBottom: 8,
  },
  goalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 8,
    alignSelf: 'flex-start',
  },
  goalInput: {
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: inputs.background,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  goalSuffix: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  goalStepButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  goalStepText: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: '800',
  },
  goalHint: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
  },
  syncErrorInline: {
    color: colors.accent,
    fontSize: 11,
    marginTop: -4,
    marginBottom: layout.sectionGap,
  },
  goalErrorText: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 4,
  },
  linkActions: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
});
