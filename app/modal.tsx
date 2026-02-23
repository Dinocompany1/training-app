import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients } from '../constants/theme';
import { useTranslation } from '../context/TranslationContext';
import BackPill from '../components/ui/BackPill';

export default function ModalScreen() {
  const { t } = useTranslation();
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  const safeUri = typeof uri === 'string' ? uri : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.appBackground} style={StyleSheet.absoluteFill} />
      <View style={styles.headerRow}>
        <BackPill />
      </View>
      {safeUri ? (
        <Image source={{ uri: safeUri }} style={styles.image} contentFit="contain" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{t('common.noImage')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
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
