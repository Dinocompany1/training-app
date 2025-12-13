import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/theme';

export default function ModalScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  const safeUri = typeof uri === 'string' ? uri : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.close} onPress={() => router.back()}>
        <Text style={styles.closeText}>Stäng</Text>
      </TouchableOpacity>
      {safeUri ? (
        <Image source={{ uri: safeUri }} style={styles.image} contentFit="contain" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Ingen bild att visa</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  closeText: {
    color: colors.textMain,
    fontWeight: '700',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  placeholder: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#0b1220',
  },
  placeholderText: {
    color: colors.textSoft,
  },
});
