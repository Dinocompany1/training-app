import { Stack, type ErrorBoundaryProps } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AICoachFab from '../components/ui/AICoachFab';
import ToastHost from '../components/ui/ToastHost';
import { colors, radii, typography } from '../constants/theme';
import { WorkoutsProvider } from '../context/WorkoutsContext';
import { TranslationProvider } from '../context/TranslationContext';
import { installGlobalErrorHandler, reportError } from '../utils/errorReporting';

const getErrorFallbackCopy = () => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() || 'en';
  const isSwedish = locale.startsWith('sv');
  if (isSwedish) {
    return {
      title: 'Något gick fel',
      body: 'Appen stötte på ett oväntat fel. Tryck på Försök igen.',
      retry: 'Försök igen',
    };
  }
  return {
    title: 'Something went wrong',
    body: 'The app hit an unexpected error. Tap Retry to continue.',
    retry: 'Retry',
  };
};

export default function RootLayout() {
  useEffect(() => {
    installGlobalErrorHandler();
  }, []);

  return (
    <TranslationProvider>
      <WorkoutsProvider>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
          <AICoachFab />
          <ToastHost />
        </View>
      </WorkoutsProvider>
    </TranslationProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const copy = getErrorFallbackCopy();

  useEffect(() => {
    reportError(error, { scope: 'root_error_boundary' });
  }, [error]);

  return (
    <View style={styles.errorWrap}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>{copy.title}</Text>
        <Text style={styles.errorBody}>
          {copy.body}
        </Text>
        <Pressable style={styles.errorButton} onPress={retry}>
          <Text style={styles.errorButtonText}>{copy.retry}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  errorWrap: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#223047',
    backgroundColor: '#0b1220',
    padding: 16,
    gap: 10,
  },
  errorTitle: {
    ...typography.title,
    color: colors.textMain,
  },
  errorBody: {
    ...typography.caption,
    color: colors.textSoft,
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 6,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: '#4ade80',
    backgroundColor: colors.success,
    paddingVertical: 10,
    alignItems: 'center',
  },
  errorButtonText: {
    ...typography.caption,
    color: '#04210f',
    fontWeight: '800',
  },
});
