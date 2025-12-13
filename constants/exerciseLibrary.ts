export type ExerciseItem = {
  name: string;
  imageUri?: string;
};

export type ExerciseGroup = {
  group: string;
  exercises: ExerciseItem[];
};

export const EXERCISE_LIBRARY: ExerciseGroup[] = [
  {
    group: 'Bröst',
    exercises: [
      { name: 'Bänkpress', imageUri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantelpress', imageUri: 'https://images.unsplash.com/photo-1584466977773-e625c37cdd50?auto=format&fit=crop&w=200&q=60' },
      { name: 'Lutande bänkpress', imageUri: 'https://images.unsplash.com/photo-1597076537014-0b4c0c2f1f85?auto=format&fit=crop&w=200&q=60' },
      { name: 'Cable flyes', imageUri: 'https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=200&q=60' },
    ],
  },
  {
    group: 'Rygg',
    exercises: [
      { name: 'Marklyft', imageUri: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=200&q=60' },
      { name: 'Latsdrag', imageUri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=60' },
      { name: 'Sittande rodd', imageUri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantelrodd', imageUri: 'https://images.unsplash.com/photo-1526402462921-9b5d0b7770e3?auto=format&fit=crop&w=200&q=60' },
    ],
  },
  {
    group: 'Ben',
    exercises: [
      { name: 'Knäböj', imageUri: 'https://images.unsplash.com/photo-1604480133080-602261a680ca?auto=format&fit=crop&w=200&q=60' },
      { name: 'Benpress', imageUri: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=200&q=60' },
      { name: 'Utfall', imageUri: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=200&q=60' },
      { name: 'Raka marklyft', imageUri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=60' },
      { name: 'Vadpress', imageUri: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=200&q=60' },
    ],
  },
  {
    group: 'Axlar',
    exercises: [
      { name: 'Militärpress', imageUri: 'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantellyft sida', imageUri: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=200&q=60' },
      { name: 'Face pulls', imageUri: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=200&q=60' },
    ],
  },
  {
    group: 'Armar',
    exercises: [
      { name: 'Bicepscurl', imageUri: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=200&q=60' },
      { name: 'Triceps pushdown', imageUri: 'https://images.unsplash.com/photo-1526401485004-2aa7c769f56f?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantelcurl', imageUri: 'https://images.unsplash.com/photo-1526401485004-2aa7c769f56f?auto=format&fit=crop&w=200&q=60' },
      { name: 'Dips', imageUri: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=200&q=60' },
    ],
  },
];

export const EXERCISE_IMAGE_MAP = EXERCISE_LIBRARY.reduce<Record<string, string>>(
  (acc, group) => {
    group.exercises.forEach((ex) => {
      if (ex.imageUri) acc[ex.name] = ex.imageUri;
    });
    return acc;
  },
  {}
);
