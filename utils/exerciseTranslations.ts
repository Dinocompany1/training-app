type TranslateFn = (path: string, fallback?: string | ((...args: any[]) => string), args?: any) => string;

const translateDynamic = (t: TranslateFn, key: string, fallback: string): string => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

export const translateExerciseGroup = (t: TranslateFn, group: string): string =>
  translateDynamic(t, `exercises.groups.${group}`, group);

export const translateExerciseName = (t: TranslateFn, name: string): string =>
  translateDynamic(t, `exercises.names.${name}`, name);
