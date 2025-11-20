import { Stack } from 'expo-router';
import React from 'react';
import { WorkoutsProvider } from '../context/WorkoutsContext';

export default function RootLayout() {
  return (
    <WorkoutsProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </WorkoutsProvider>
  );
}
