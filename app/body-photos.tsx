// app/body-photos.tsx
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../components/ui/GlassCard';
import BackPill from '../components/ui/BackPill';
import ScreenHeader from '../components/ui/ScreenHeader';
import { colors, gradients, inputs, spacing, typography } from '../constants/theme';
import { BodyPhoto, useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';
import { compareISODate, todayISO } from '../utils/date';
import { createId } from '../utils/id';
import { toast } from '../utils/toast';

const todayStr = todayISO();

export default function BodyPhotosScreen() {
  const router = useRouter();
  const { bodyPhotos, addBodyPhoto, removeBodyPhoto } = useWorkouts();
  const { t } = useTranslation();

  const [uri, setUri] = useState('');
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');
  const [pickError, setPickError] = useState('');
  const [focusedInput, setFocusedInput] = useState<'date' | 'note' | null>(null);

  const sorted = useMemo(() => {
    return [...bodyPhotos].sort((a, b) => {
      const timeDiff = compareISODate(b.date, a.date);
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });
  }, [bodyPhotos]);

  const handleAdd = () => {
    const trimmed = uri.trim();
    if (!trimmed) {
      Alert.alert(t('common.error'), t('bodyPhotos.urlError'));
      return;
    }
    const photo: BodyPhoto = {
      id: createId('photo'),
      uri: trimmed,
      date: date || todayStr,
      note: note.trim() || undefined,
    };
    addBodyPhoto(photo);
    setUri('');
    setNote('');
    setPickError('');
  };

  const pickImage = async () => {
    setPickError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickError(t('bodyPhotos.permissionError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    setUri(asset.uri || '');
  };

  const handleRemove = (id: string) => {
    const photo = bodyPhotos.find((p) => p.id === id);
    if (!photo) return;
    Alert.alert(t('bodyPhotos.deleteTitle'), t('bodyPhotos.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          removeBodyPhoto(id);
          toast({
            message: t('bodyPhotos.deletedToast'),
            action: {
              label: t('common.undo'),
              onPress: () => {
                addBodyPhoto(photo);
                toast(t('common.restored'));
              },
            },
          });
        },
      },
    ]);
  };

  return (
    <LinearGradient
      colors={gradients.appBackground}
      style={styles.full}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <BackPill onPress={() => router.back()} />
          <ScreenHeader title={t('bodyPhotos.title')} compact tone="rose" style={styles.headerTitle} />
          <View style={styles.headerSpacer} />
        </View>
        <GlassCard style={styles.card}>
          <Text style={styles.cardHeading}>{t('bodyPhotos.title')}</Text>
          {uri ? (
            <Text style={styles.pickHint}>{t('bodyPhotos.selected')}</Text>
          ) : null}
          {pickError ? (
            <Text style={styles.errorText}>{pickError}</Text>
          ) : null}
          <TextInput
            style={[styles.input, focusedInput === 'date' ? styles.inputFocused : null]}
            value={date}
            onChangeText={setDate}
            onFocus={() => setFocusedInput('date')}
            onBlur={() => setFocusedInput(null)}
            placeholder={t('bodyPhotos.datePlaceholder')}
            placeholderTextColor={colors.textSoft}
          />
          <TextInput
            style={[
              styles.input,
              styles.noteInput,
              focusedInput === 'note' ? styles.inputFocused : null,
            ]}
            value={note}
            onChangeText={setNote}
            onFocus={() => setFocusedInput('note')}
            onBlur={() => setFocusedInput(null)}
            placeholder={t('bodyPhotos.notePlaceholder')}
            placeholderTextColor={colors.textSoft}
            multiline
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              if (!uri) {
                pickImage();
              } else {
                handleAdd();
              }
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.saveButtonText}>
              {uri ? t('bodyPhotos.saveCta') : '+ Lägg till bild'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.grid}>
          {sorted.map((p) => (
              <GlassCard key={p.id} style={styles.photoCard}>
                <View style={styles.photoHeader}>
                  <View>
                    <Text style={styles.photoDate}>{p.date}</Text>
                    {p.note ? (
                      <Text style={styles.photoNote} numberOfLines={2}>
                        {p.note}
                      </Text>
                    ) : (
                      <Text style={styles.photoNoteMuted}>{t('bodyPhotos.noNote')}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(p.id)}>
                    <Trash2 size={16} color="#fca5a5" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/modal', params: { uri: p.uri } })}
                  accessibilityLabel={t('bodyPhotos.viewFull')}
                  accessibilityRole="button"
                >
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: p.uri }}
                      style={styles.image}
                      contentFit="cover"
                    />
                  </View>
                </TouchableOpacity>
              </GlassCard>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: spacing.xl + 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  headerTitle: {
    flex: 1,
    marginBottom: 0,
  },
  headerSpacer: {
    width: 44,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    color: colors.textMain,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSoft,
    marginBottom: 10,
  },
  card: {
    marginBottom: 12,
  },
  cardHeading: {
    ...typography.bodyBold,
    color: colors.textMain,
    marginBottom: 8,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickText: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  pickHint: {
    ...typography.caption,
    color: colors.textSoft,
    marginBottom: 6,
  },
  errorText: {
    ...typography.caption,
    color: '#fca5a5',
    marginBottom: 6,
  },
  input: {
    flex: 1,
    minHeight: inputs.height,
    backgroundColor: inputs.background,
    borderRadius: inputs.radius,
    borderWidth: 1,
    borderColor: inputs.borderColor,
    color: colors.textMain,
    paddingHorizontal: inputs.paddingX,
    paddingVertical: inputs.paddingY,
    ...typography.body,
  },
  inputFocused: {
    borderColor: '#60a5fa',
    shadowColor: '#60a5fa',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  noteInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: '#0b1220',
  },
  grid: {
    gap: 10,
  },
  photoCard: {},
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  photoDate: {
    ...typography.bodyBold,
    color: colors.textMain,
  },
  photoNote: {
    ...typography.micro,
    color: colors.textSoft,
  },
  photoNoteMuted: {
    ...typography.micro,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    height: 200,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
