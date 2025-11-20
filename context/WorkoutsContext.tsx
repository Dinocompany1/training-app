import React, {
    createContext,
    ReactNode,
    useContext,
    useState,
} from 'react';

export interface Exercise {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight?: string;
}

export interface Workout {
  id: string;
  date: string;
  title: string;
  notes: string;
  exercises: Exercise[];
}

interface WorkoutsContextValue {
  workouts: Workout[];
  addWorkout: (workout: Omit<Workout, 'id'>) => void;
  weeklyGoal: number;
  setWeeklyGoal: (goal: number) => void;
}

const WorkoutsContext = createContext<WorkoutsContextValue | undefined>(
  undefined
);

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([
    {
      id: '1',
      date: '2025-11-19',
      title: 'Push-pass',
      notes: 'Bänkpress, axlar, triceps',
      exercises: [
        { id: 'e1', name: 'Bänkpress', sets: '3', reps: '8', weight: '80' },
        { id: 'e2', name: 'Arnoldpress', sets: '3', reps: '10', weight: '18' },
      ],
    },
    {
      id: '2',
      date: '2025-11-18',
      title: 'Ben-pass',
      notes: 'Knäböj, utfall, vader',
      exercises: [
        { id: 'e3', name: 'Knäböj', sets: '4', reps: '6', weight: '100' },
      ],
    },
  ]);

  const [weeklyGoal, setWeeklyGoal] = useState<number>(3);

  const addWorkout = (workout: Omit<Workout, 'id'>) => {
    const newWorkout: Workout = {
      id: Date.now().toString(),
      ...workout,
    };
    setWorkouts((prev) => [newWorkout, ...prev]);
  };

  return (
    <WorkoutsContext.Provider
      value={{ workouts, addWorkout, weeklyGoal, setWeeklyGoal }}
    >
      {children}
    </WorkoutsContext.Provider>
  );
}

export function useWorkouts() {
  const ctx = useContext(WorkoutsContext);
  if (!ctx) {
    throw new Error('useWorkouts måste användas inuti WorkoutsProvider');
  }
  return ctx;
}
