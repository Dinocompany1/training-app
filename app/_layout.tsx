import { Stack } from 'expo-router';
import { WorkoutsProvider } from './context/WorkoutsContext';

export default function RootLayout() {
  return (
    <WorkoutsProvider>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="workout/[id]"
          options={{ title: 'Träningspass' }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
    </WorkoutsProvider>
  );
}
