// app/(tabs)/profile.tsx
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Target, User, Image as ImageIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../../components/ui/GlassCard';
import NeonButton from '../../components/ui/NeonButton';
import BadgePill from '../../components/ui/BadgePill';
import { colors, gradients, typography } from '../../constants/theme';
import EmptyState from '../../components/ui/EmptyState';
import { useWorkouts } from '../../context/WorkoutsContext';
import { toast } from '../../utils/toast';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTranslation } from '../../context/TranslationContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { weeklyGoal, setWeeklyGoal, workouts, addBodyPhoto } = useWorkouts();
  const { lang, setLanguage, t } = useTranslation();
  const [goalInput, setGoalInput] = useState(String(weeklyGoal));
  const [goalError, setGoalError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode] = useState(true); // bara visuellt – appen är redan dark
  const totalWorkouts = workouts.length;
  const noWorkouts = totalWorkouts === 0;
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const todayStr = new Date().toISOString().slice(0, 10);

  const handleGoalBlur = () => {
    const clean = goalInput.replace(/[^0-9]/g, '');
    const n = Number(clean);
    if (Number.isNaN(n)) {
      setGoalError(t('profile.goalError'));
      setGoalInput(String(weeklyGoal));
      return;
    }
    const clamped = Math.max(0, Math.min(14, n));
    setGoalError('');
    setWeeklyGoal(clamped);
    setGoalInput(String(clamped));
  };

  return (
    <View style={styles.gradient}>
      <LinearGradient
        colors={gradients.appBackground}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER / USER CARD */}
          <GlassCard style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.avatarCircle}>
                <User size={30} color="#e5e7eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nameText}>{t('profile.title')}</Text>
                <Text style={styles.subtitleText}>
                  {t('profile.subtitle')}
                </Text>
              </View>
            </View>

            <View style={styles.langRow}>
              <Text style={styles.langLabel}>{t('profile.language')}</Text>
              <View style={styles.langButtons}>
                {[
                  { key: 'sv', label: t('profile.langSv', 'Svenska') },
                  { key: 'en', label: t('profile.langEn', 'English') },
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

          {/* MÅL / VECKOMÅL */}
          <GlassCard style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Target size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('profile.weeklyCardTitle')}</Text>
            </View>
            <Text style={styles.sectionSub}>
              {t('profile.weeklyCardSub')}
            </Text>

            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>{t('profile.goalLabel')}</Text>
              <View style={styles.goalInputRow}>
                <TextInput
                  value={goalInput}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/[^0-9]/g, '').slice(0, 2);
                    setGoalError('');
                    setGoalInput(cleaned);
                  }}
                  onBlur={handleGoalBlur}
                  keyboardType="number-pad"
                  style={styles.goalInput}
                  maxLength={2}
                  accessibilityLabel={t('profile.goalA11y')}
                  accessibilityRole="adjustable"
                />
                <Text style={styles.goalSuffix}>{t('profile.goalSuffix')}</Text>
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
              <Text style={{ color: '#fca5a5', fontSize: 12, marginTop: 4 }}>
                {goalError}
              </Text>
            ) : null}
          </GlassCard>

          {/* KROPPSBILDER */}
          <GlassCard style={styles.card}>
            <View style={styles.cardTitleRow}>
              <ImageIcon size={20} color={colors.accentBlue} />
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
                      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                      if (!perm.granted) {
                        Alert.alert(t('profile.permTitle'), t('profile.permBody'));
                        return;
                      }
                      const res = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.8,
                      });
                      if (!res.canceled && res.assets && res.assets[0]?.uri) {
                        setSelectedUri(res.assets[0].uri);
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
                    placeholder={t('profile.photoNotePlaceholder')}
                    placeholderTextColor={colors.textSoft}
                    style={[styles.photoInput, styles.photoNote]}
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
                          id: Date.now().toString(),
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
                    <TouchableOpacity
                      style={[styles.pbEmptyButton, styles.secondaryButton]}
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
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                      Alert.alert(t('profile.permTitle'), t('profile.permBody'));
                      return;
                    }
                    const res = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.8,
                    });
                    if (!res.canceled && res.assets && res.assets[0]?.uri) {
                      setSelectedUri(res.assets[0].uri);
                      toast(t('profile.photoPicked'));
                    }
                  }}
                />
              )}
              {!selectedUri && (
                <View style={[styles.photoActions, { marginTop: 4 }]}>
                  <TouchableOpacity
                    style={[styles.pbEmptyButton, styles.secondaryButton]}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  headerCard: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  nameText: {
    ...typography.title,
    color: colors.textMain,
  },
  subtitleText: {
    ...typography.caption,
    color: colors.textSoft,
    marginTop: 2,
  },
  langRow: {
    marginTop: 12,
    gap: 6,
  },
  langLabel: {
    ...typography.caption,
    color: colors.textSoft,
  },
  langButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  langButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  langButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#1e1b4b',
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
    marginTop: 4,
  },
  headerStatBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#111827',
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
    marginBottom: 12,
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
    marginBottom: 8,
  },
  bodyPhotoButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bodyPhotoButtonText: {
    ...typography.bodyBold,
    color: '#0b1220',
    fontSize: 13,
  },
  photoInputs: {
    gap: 8,
    marginTop: 6,
  },
  photoInput: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    color: colors.textMain,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  photoNote: {
    minHeight: 50,
  },
  photoPreview: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
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
    color: '#e5e7eb',
    fontSize: 11,
    backgroundColor: '#00000066',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pbEmpty: {
    gap: 8,
  },
  pbEmptyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pbEmptyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  pbEmptyButtonText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#334155',
  },

  goalRow: {
    marginTop: 4,
    marginBottom: 6,
  },
  goalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalInput: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
    color: colors.textMain,
    textAlign: 'center',
  },
  goalSuffix: {
    color: colors.textMain,
    fontSize: 13,
  },
  goalHint: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  settingLabel: {
    color: colors.textMain,
    fontSize: 13,
    fontWeight: '600',
  },
  settingSub: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: 2,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  themePillText: {
    color: colors.textMain,
    fontSize: 12,
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accentBlue,
    marginTop: 5,
  },
  bulletText: {
    color: colors.textSoft,
    fontSize: 11,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  quickChipPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  quickChipText: {
    ...typography.caption,
    color: colors.textMain,
    fontWeight: '700',
  },
  quickChipTextDark: {
    ...typography.caption,
    color: '#0b1024',
    fontWeight: '800',
  },
  latestBox: {
    marginTop: 6,
    gap: 8,
  },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  latestDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  latestTitle: {
    ...typography.bodyBold,
    color: colors.textMain,
    fontSize: 14,
  },
  latestMeta: {
    color: colors.textSoft,
    fontSize: 11,
  },
  todayButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  buttonSmall: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  buttonSmallText: {
    color: colors.textMain,
    fontWeight: '700',
    fontSize: 12,
  },
});
