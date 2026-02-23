import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyExerciseRouteRedirect() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const rawName = Array.isArray(name) ? name[0] : name;

  if (!rawName) {
    return <Redirect href="/exercise-progress" />;
  }

  return <Redirect href={`/exercise-progress/${encodeURIComponent(rawName)}`} />;
}

