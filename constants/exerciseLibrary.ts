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
      { name: 'Decline bänkpress' },
      { name: 'Maskinpress bröst' },
      { name: 'Pec deck' },
      { name: 'Armhävningar' },
      { name: 'Smal bänkpress' },
      { name: 'Guillotine press' },
      { name: 'Squeeze press' },
      { name: 'Kabelcross hög-låg' },
      { name: 'Kabelcross låg-hög' },
      { name: 'Pullover hantel' },
    ],
  },
  {
    group: 'Rygg',
    exercises: [
      { name: 'Marklyft', imageUri: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=200&q=60' },
      { name: 'Latsdrag', imageUri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=60' },
      { name: 'Sittande rodd', imageUri: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantelrodd', imageUri: 'https://images.unsplash.com/photo-1526402462921-9b5d0b7770e3?auto=format&fit=crop&w=200&q=60' },
      { name: 'T-bar rodd' },
      { name: 'Chins' },
      { name: 'Pullups' },
      { name: 'Rack pull' },
      { name: 'Straight arm pulldown' },
      { name: 'Enarms kabelrodd' },
      { name: 'Seal row' },
      { name: 'Inverted row' },
      { name: 'Maskinrodd' },
      { name: 'Good mornings' },
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
      { name: 'Frontböj' },
      { name: 'Bulgarian split squats' },
      { name: 'Hip thrust' },
      { name: 'Leg extension' },
      { name: 'Lårcurl sittande' },
      { name: 'Lårcurl liggande' },
      { name: 'Hack squat' },
      { name: 'Goblet squat' },
      { name: 'Step-ups' },
      { name: 'Glute bridge' },
      { name: 'Adductor maskin' },
      { name: 'Abductor maskin' },
    ],
  },
  {
    group: 'Axlar',
    exercises: [
      { name: 'Militärpress', imageUri: 'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantellyft sida', imageUri: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=200&q=60' },
      { name: 'Face pulls', imageUri: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=200&q=60' },
      { name: 'Arnold press' },
      { name: 'Push press' },
      { name: 'Omvänd pec deck' },
      { name: 'Upright row' },
      { name: 'Front raises' },
      { name: 'Landmine press' },
      { name: 'Hantelpress sittande' },
      { name: 'Y-raises' },
    ],
  },
  {
    group: 'Armar',
    exercises: [
      { name: 'Bicepscurl', imageUri: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?auto=format&fit=crop&w=200&q=60' },
      { name: 'Triceps pushdown', imageUri: 'https://images.unsplash.com/photo-1526401485004-2aa7c769f56f?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hantelcurl', imageUri: 'https://images.unsplash.com/photo-1526401485004-2aa7c769f56f?auto=format&fit=crop&w=200&q=60' },
      { name: 'Dips', imageUri: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=200&q=60' },
      { name: 'Hammercurl' },
      { name: 'Preacher curl' },
      { name: 'Kabelcurl' },
      { name: 'Skull crushers' },
      { name: 'Triceps overhead extension' },
      { name: 'Triceps kickback' },
      { name: 'Close grip pushups' },
      { name: 'Reverse curl' },
      { name: 'Zottman curl' },
      { name: 'Enarms triceps pushdown' },
    ],
  },
  {
    group: 'Övrigt',
    exercises: [
      { name: 'Plankan' },
      { name: 'Sidoplankan' },
      { name: 'Hängande benlyft' },
      { name: 'Cable crunch' },
      { name: 'Russian twists' },
      { name: 'Ab wheel rollout' },
      { name: 'Ryggresningar' },
      { name: 'Farmer walk' },
      { name: 'Battle ropes' },
      { name: 'Roddmaskin intervall' },
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
