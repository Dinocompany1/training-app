// app/body-photos.tsx
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, Trash2 } from 'lucide-react-native';
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
import { colors, gradients, typography } from '../constants/theme';
import { BodyPhoto, useWorkouts } from '../context/WorkoutsContext';
import { useTranslation } from '../context/TranslationContext';

const todayStr = new Date().toISOString().slice(0, 10);

export default function BodyPhotosScreen() {
  const router = useRouter();
  const { bodyPhotos, addBodyPhoto, removeBodyPhoto } = useWorkouts();
  const { t } = useTranslation();

  const [uri, setUri] = useState('');
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');
  const [pickError, setPickError] = useState('');

  const sorted = useMemo(() => {
    return [...bodyPhotos].sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [bodyPhotos]);

  const handleAdd = () => {
    const trimmed = uri.trim();
    if (!trimmed) {
      Alert.alert(t('common.error'), t('bodyPhotos.urlError'));
      return;
    }
    const photo: BodyPhoto = {
      id: Date.now().toString(),
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
    Alert.alert(t('bodyPhotos.deleteTitle'), t('bodyPhotos.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => removeBodyPhoto(id),
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
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>{t('bodyPhotos.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('bodyPhotos.title')}</Text>
          <View style={{ width: 70 }} />
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
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder={t('bodyPhotos.datePlaceholder')}
            placeholderTextColor={colors.textSoft}
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
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
    paddingTop: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backText: {
    ...typography.caption,
    color: colors.textSoft,
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
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111827',
    color: colors.textMain,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...typography.body,
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
