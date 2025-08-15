export const ExerciseType = {
  Sets: "CLASSIC",
  TimeIntervals: "INTERVALS",
  Duration: "DURATION",
  Distance: "DISTANCE",
  CheckOff: "CHECK_OFF",
} as const;

export type ExerciseType = (typeof ExerciseType)[keyof typeof ExerciseType];

export type TTrackingSettings = {
  rir: boolean;
  "1rm": boolean;
  "10rm": boolean;
};

export interface TSet {
  id: string
  order: number
  status: "todo" | "completed" | "skipped"
  reps?: number | null
  weight?: number | null
  duration?: number | null
  distance?: number | null
  rir?: number | null
  notes?: string | null
  side?: "left" | "right" | null;
}

export type TTrackingOverrides = {
  rir?: boolean;
  '10rm'?: boolean;
  '1rm'?: boolean;
   last1rm?: boolean;
   last10rm?: boolean;
};

export interface TExercise {
  id:string
  order: number
  name: string
  type: ExerciseType | string
  sets?: TSet[] | null | undefined
  bodyPart?: string
  equipment?: string
  target?: string
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
  templateId?: string
  notes?: string
  isNotePinned?: boolean 
  restBetweenSets?: number
  targetSets?: number;
  targetReps?: number;
  trackingOverrides?: TTrackingOverrides
}

export interface TDay {
    id: string;
    order: number;
    name: string;
    exercises: TExercise[];
}

export interface TPlan {
  id: string
  name: string
  days: TDay[];
  isActive: boolean;
}

export interface TWorkoutSession {
  id: string
  planId?: string
  dayId?: string;
  name: string
  exercises: TExercise[]
  startTime: Date
  endTime?: Date
  completedAt?: Date
}

export type TExerciseLibraryItem = {
    id: string;
    name: string;
    bodyPart: string;
    equipment: string;
    target: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    instructions: string[];
    compound?: boolean;
    unilateral?: boolean;
};

export const planDayDataKey = Symbol("plan-day");
export const planExerciseDataKey = Symbol("plan-exercise");

interface DraggableWithId {
  id: string;
}

export type TPlanDayData = {
  [planDayDataKey]: true
  dayId: TDay["id"]
}

export type TPlanExerciseData = {
  [planExerciseDataKey]: true
  exerciseId: TExercise["id"]
  dayId: TDay["id"]
}

export function getPlanDayData(day: TDay | { $jazz: { id: string } }): TPlanDayData {
  return {
    [planDayDataKey]: true,
    dayId: 'id' in day ? day.id : day.$jazz.id,
  }
}

export function getPlanExerciseData(exercise: DraggableWithId | { $jazz: { id: string } }, dayId: TDay['id']): TPlanExerciseData {
    return {
        [planExerciseDataKey]: true,
        exerciseId: 'id' in exercise ? exercise.id : exercise.$jazz.id,
        dayId: dayId,
    };
}

export function isPlanDayData(
  data: Record<string | symbol, unknown>
): data is TPlanDayData {
  return data[planDayDataKey] === true;
}

export function isPlanExerciseData(
  data: Record<string | symbol, unknown>
): data is TPlanExerciseData {
  return data[planExerciseDataKey] === true;
}

export const exerciseDataKey = Symbol("exercise");
export const setDataKey = Symbol("set");
export type TExerciseData = { [exerciseDataKey]: true; exerciseId: TExercise["id"]; };
export type TSetData = { [setDataKey]: true; setId: TSet["id"]; exerciseId: TExercise["id"]; };
export const getExerciseData = (exercise: DraggableWithId | { $jazz: { id: string } }): TExerciseData => ({
  [exerciseDataKey]: true,
  exerciseId: 'id' in exercise ? exercise.id : exercise.$jazz.id
});
export const getSetData = (set: TSet | { $jazz: { id: string } }, exerciseId: TExercise['id']): TSetData => ({
  [setDataKey]: true,
  setId: 'id' in set ? set.id : set.$jazz.id,
  exerciseId
});
export function isExerciseData(data: Record<string | symbol, unknown>): data is TExerciseData { return data[exerciseDataKey] === true; }
export function isSetData(data: Record<string | symbol, unknown>): data is TSetData { return data[setDataKey] === true; }