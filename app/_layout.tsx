// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import { WorkoutsProvider } from '../context/WorkoutsContext';
import { TranslationProvider } from '../context/TranslationContext';

export default function RootLayout() {
  return (
    <TranslationProvider>
      <WorkoutsProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </WorkoutsProvider>
    </TranslationProvider>
  );
}
