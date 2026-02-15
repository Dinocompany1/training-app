import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import AICoachFab from '../components/ui/AICoachFab';
import { WorkoutsProvider } from '../context/WorkoutsContext';
import { TranslationProvider } from '../context/TranslationContext';

export default function RootLayout() {
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
        </View>
      </WorkoutsProvider>
    </TranslationProvider>
  );
}
