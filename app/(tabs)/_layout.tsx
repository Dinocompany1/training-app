import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { backgroundColor: '#020617' },
        headerStyle: { backgroundColor: '#020617' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Hem' }}
      />

      <Tabs.Screen
        name="add-workout"
        options={{ title: 'Lägg till' }}
      />

      <Tabs.Screen
        name="calendar"
        options={{ title: 'Kalender' }}
      />

      <Tabs.Screen
        name="stats"
        options={{ title: 'Statistik' }}
      />

      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil' }}
      />
    </Tabs>
  );
}
