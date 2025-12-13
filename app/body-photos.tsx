// app/body-photos.tsx
import { LinearGradient } from 'expo-linear-gradient';
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

const todayStr = new Date().toISOString().slice(0, 10);

export default function BodyPhotosScreen() {
  const router = useRouter();
  const { bodyPhotos, addBodyPhoto, removeBodyPhoto } = useWorkouts();

  const [uri, setUri] = useState('');
  const [date, setDate] = useState(todayStr);
  const [note, setNote] = useState('');

  const sorted = useMemo(
    () =>
      [...bodyPhotos].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [bodyPhotos]
  );

  const handleAdd = () => {
    const trimmed = uri.trim();
    if (!trimmed) {
      Alert.alert('Fel', 'Lägg in en bild-URL först.');
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
  };

  const handleRemove = (id: string) => {
    Alert.alert('Ta bort bild', 'Är du säker?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
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
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Tillbaka</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Kroppsbilder</Text>
          <View style={{ width: 70 }} />
        </View>
        <Text style={styles.subtitle}>
          Spara formbilder och anteckningar. Klistra in en URL till bilden för
          att spara den (kamerauppladdning kan läggas till senare).
        </Text>

        <GlassCard style={styles.card}>
          <View style={styles.inputRow}>
            <Camera size={18} color={colors.accentBlue} />
            <TextInput
              style={styles.input}
              value={uri}
              onChangeText={setUri}
              placeholder="Bild-URL (https://...)"
              placeholderTextColor={colors.textSoft}
              autoCapitalize="none"
            />
          </View>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSoft}
          />
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Anteckning (valfritt)"
            placeholderTextColor={colors.textSoft}
            multiline
          />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleAdd}
            activeOpacity={0.9}
          >
            <Text style={styles.saveButtonText}>+ Lägg till bild</Text>
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
                      <Text style={styles.photoNoteMuted}>Ingen anteckning</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(p.id)}>
                    <Trash2 size={16} color="#fca5a5" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push({ pathname: '/modal', params: { uri: p.uri } })}
                  accessibilityLabel="Visa bild i full storlek"
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
    paddingTop: 12,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
