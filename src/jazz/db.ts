import { ExerciseType, type TExerciseLibraryItem } from '@/lib/types';
import { convertDisplayToKg, convertKgToDisplay } from '@/lib/utils';
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge';
import { co, z } from 'jazz-tools';
import { useAccount, useCoState } from 'jazz-tools/react';
import { masterLibrary } from '../data/master-library';
import { useAccountSelector } from '../components/AccountProvider';
import i18n from '@/i18n';
import {
  CustomExercise,
  Exercise,
  Plan,
  PlanDay,
  PlanExercise,
  RestTimerState,
  Session,
  Settings,
  WorkoutAppAccount,
  WorkoutSet
} from './schema';

export type PlanWithRelations = co.loaded<typeof Plan, { days: { $each: { exercises: { $each: true } } } }>;
export type PlanDayWithRelations = co.loaded<typeof PlanDay, { exercises: { $each: true } }>;
export type PlanExerciseResolved = co.loaded<typeof PlanExercise>;
export type SessionWithRelations = co.loaded<typeof Session, { exercises: { $each: { sets: { $each: true } } } }>;
export type ExerciseWithRelations = co.loaded<typeof Exercise, { sets: { $each: true } }>;
export type SetResolved = co.loaded<typeof WorkoutSet>;
export type SettingsResolved = co.loaded<typeof Settings>;
export type CustomExerciseResolved = co.loaded<typeof CustomExercise>;

export const useMyAccount = () => {
  const me = useAccount(WorkoutAppAccount);
  return { me };
};

export const useCustomExercises = () => {
  const customExercises = useAccountSelector({
    select: (me) =>
      me.root ? Object.values(me.root.customExercises ?? {}).filter((ex): ex is CustomExerciseResolved => !!ex) : []
  });

  return { customExercises };
};

export const useSettings = () => {
  const settings = useAccountSelector({
    select: (me) => me.root?.settings
  });
  return { settings };
};

export const usePlan = (planId: string | undefined) => {
  const plan = useCoState(Plan, planId, {
    resolve: { days: { $each: { exercises: { $each: true } } } }
  });
  return { plan: plan as PlanWithRelations | null, fetching: plan === undefined };
};

export const useSession = (sessionId: string | undefined) => {
  const session = useCoState(Session, sessionId, {
    resolve: { exercises: { $each: { sets: { $each: true } } } }
  });
  return { session: session as SessionWithRelations | null };
};

export function findLastPerformanceForExercise(
  sessions: SessionWithRelations[] | undefined | null,
  templateId: string,
  currentSessionId: string | undefined,
  beforeDate: Date,
): ExerciseWithRelations | null {
  if (!sessions || !templateId) {
    return null;
  }
  const completedSessions = sessions
    .filter(
      (s): s is SessionWithRelations =>
        !!s?.completedAt &&
        s.$jazz.id !== currentSessionId &&
        new Date(s.completedAt).getTime() < beforeDate.getTime(),
    )
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    );
  for (const session of completedSessions) {
    const foundExercise = (session.exercises || []).find(
      (e) =>
        e?.templateId === templateId &&
        e.sets.some((s) => s?.status === "completed"),
    );
    if (foundExercise) {
      return foundExercise as ExerciseWithRelations;
    }
  }
  return null;
}

export const useRestTimer = () => {
  const restTimer = useAccountSelector({
    select: (me) => me.root?.restTimer
  });
  return restTimer;
};

export const startRestTimer = async (duration: number) => {
  const me = await WorkoutAppAccount.getMe();
  if (!me.root) return;
  const now = new Date();
  me.root.$jazz.set("restTimer", RestTimerState.create({
        key: now.getTime(),
        initialDuration: duration,
        endTime: new Date(now.getTime() + duration * 1000),
        isPaused: false,
      }));
};

export const clearRestTimer = async () => {
  const me = await WorkoutAppAccount.getMe();
  if (!me.root) return;
  me.root.$jazz.delete("restTimer");
};

export const togglePauseRestTimer = async () => {
  const me = await WorkoutAppAccount.getMe();
  if (!me.root) return;
  const timer = me.root.restTimer;
  if (!timer) return;

  const now = new Date();
  if (timer.isPaused) {
    const timePausedMs = now.getTime() - (timer.pauseTime?.getTime() || now.getTime());
    const newEndTime = new Date(timer.endTime.getTime() + timePausedMs);
    timer.$jazz.set("isPaused", false);
    timer.$jazz.delete("pauseTime");
    timer.$jazz.set("endTime", newEndTime);
  } else {
    timer.$jazz.set("isPaused", true);
    timer.$jazz.set("pauseTime", now);
  }
};

export const adjustRestTimer = async (seconds: number) => {
  const me = await WorkoutAppAccount.getMe();
  if (!me.root) return;
  const timer = me.root.restTimer;
  if (!timer) return;
  const adjustmentMs = seconds * 1000;
  timer.$jazz.set("endTime", new Date(timer.endTime.getTime() + adjustmentMs));
};

export const resetRestTimer = async () => {
  const me = await WorkoutAppAccount.getMe();
  if (!me.root) return;
  const timer = me.root.restTimer;
  if (!timer) return;
  const now = new Date();
  timer.$jazz.set("endTime", new Date(now.getTime() + timer.initialDuration * 1000));
  timer.$jazz.set("isPaused", false);
  timer.$jazz.delete("pauseTime");
};

const getRoot = async () => (await WorkoutAppAccount.getMe()).root;

export const sharePlan = async (plan: PlanWithRelations) => {
    const me = await WorkoutAppAccount.getMe();
    const { root } = await me.$jazz.ensureLoaded({ resolve: { root: { customExercises: { $each: { primaryMuscleKeys: true, secondaryMuscleKeys: true, instructions: true } } } } });
    if (!root) return null;

    plan.$jazz.owner.makePublic('reader');
    for (const day of plan.days || []) {
        day?.$jazz.owner.makePublic('reader');
        for (const exercise of day?.exercises || []) { exercise?.$jazz.owner.makePublic('reader'); }
    }

    const customExerciseIds = new Set<string>();
    for (const day of plan.days || []) {
        for (const exercise of day?.exercises || []) {
            if (exercise?.templateId.startsWith('custom_')) { customExerciseIds.add(exercise.templateId); }
        }
    }
    for (const id of customExerciseIds) {
        const customEx = root.customExercises?.[id];
        customEx?.$jazz.owner.makePublic('reader');
    }

    return `${window.location.origin}/share/plan/${plan.$jazz.id}`;
};

export const duplicatePlan = async (planIdToCopy: string): Promise<string | null> => {
    const me = await WorkoutAppAccount.getMe();
    const { root } = await me.$jazz.ensureLoaded({ resolve: { root: { plans: true, customExercises: { $each: true } } } });
    if (!root?.plans) return null;

    const planToCopy = await Plan.load(planIdToCopy, { resolve: { days: { $each: { exercises: { $each: true } } } } });
    if (!planToCopy) return null;

    const customExerciseIdMap = new Map<string, string>();
    if (!root.customExercises) {
        root.$jazz.set("customExercises", co.record(z.string(), CustomExercise).create({}));
    }

    for (const day of planToCopy.days || []) {
        for (const exercise of day?.exercises || []) {
            if (exercise && exercise.templateId.startsWith('custom_') && !customExerciseIdMap.has(exercise.templateId)) {
                if (root.customExercises[exercise.templateId]) {
                    customExerciseIdMap.set(exercise.templateId, exercise.templateId);
                    continue;
                }
                const publicCustomEx = await CustomExercise.load(exercise.templateId, {
                    resolve: { primaryMuscleKeys: true, secondaryMuscleKeys: true, instructions: true }
                });
                if (publicCustomEx) {
                    const newPrivateEx = CustomExercise.create({
                        name: publicCustomEx.name,
                        bodyPart: publicCustomEx.bodyPart,
                        equipment: publicCustomEx.equipment,
                        primaryMuscleKeys: publicCustomEx.primaryMuscleKeys?.slice() || [],
                        secondaryMuscleKeys: publicCustomEx.secondaryMuscleKeys?.slice() || [],
                        instructions: publicCustomEx.instructions?.slice() || [],
                        compound: publicCustomEx.compound,
                    });
                    root.customExercises.$jazz.set(newPrivateEx.$jazz.id, newPrivateEx);
                    customExerciseIdMap.set(exercise.templateId, newPrivateEx.$jazz.id);
                }
            }
        }
    }

    const newPlan = Plan.create({
        name: `${planToCopy.name} ${i18n.t('database.copy')}`,
        isActive: false,
        days: (planToCopy.days || []).filter((day): day is PlanDayWithRelations => !!day).map(day => PlanDay.create({
            name: day.name,
            order: day.order,
            exercises: (day.exercises || []).filter((ex): ex is PlanExerciseResolved => !!ex).map(ex => PlanExercise.create({
                order: ex.order,
                templateId: customExerciseIdMap.get(ex.templateId) || ex.templateId,
                name: ex.name,
                type: ex.type,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps,
                restBetweenSets: ex.restBetweenSets,
                weightUnit: ex.weightUnit,
            }))
        }))
    });

    root.plans.$jazz.push(newPlan);
    return newPlan.$jazz.id;
};

export const remapExerciseTemplateId = async (oldTemplateId: string, newTemplateId: string) => {
    const me = await WorkoutAppAccount.getMe();
    const { root } = await me.$jazz.ensureLoaded({
            resolve: {
                root: {
                    plans: { $each: { days: { $each: { exercises: { $each: true } } } } },
                    sessions: { $each: { exercises: { $each: true } } },
                    settings: { progressionOverrides: true }
                }
            }
        });

    if (!root) return;

    for (const session of root.sessions || []) {
        for (const exercise of session?.exercises || []) {
            if (exercise?.templateId === oldTemplateId) {
                exercise.$jazz.set("templateId", newTemplateId);
            }
        }
    }

    for (const plan of root.plans || []) {
        for (const day of plan?.days || []) {
            for (const exercise of day?.exercises || []) {
                if (exercise?.templateId === oldTemplateId) {
                    exercise.$jazz.set("templateId", newTemplateId);
                }
            }
        }
    }

    if (root.settings?.progressionOverrides && root.settings.progressionOverrides[oldTemplateId]) {
        root.settings.progressionOverrides.$jazz.set(newTemplateId, root.settings.progressionOverrides[oldTemplateId]);
        root.settings.progressionOverrides.$jazz.delete(oldTemplateId);
    }
};

export const createPlan = async () => {
  const root = await getRoot();
  if (!root?.plans) return '';
  const newPlan = Plan.create({
    name: i18n.t('database.newWorkoutPlan'),
    isActive: root.plans.length === 0,
    days: []
  });
  root.plans.$jazz.push(newPlan);
  return newPlan.$jazz.id;
};

export const updatePlan = (plan: PlanWithRelations, updates: Partial<Pick<PlanWithRelations, 'name' | 'isActive' | 'days'>>) => {
  const keys = Object.keys(updates) as (keyof typeof updates)[];
  keys.forEach(key => {
    const value = updates[key];
    if (value !== undefined) {
      plan.$jazz.set(key, value);
    }
  });
};

export const deletePlan = async (planId: string) => {
  const root = await getRoot();
  if (!root?.plans) return;
  const index = root.plans.findIndex(p => p?.$jazz.id === planId);
  if (index > -1) {
    root.plans.$jazz.splice(index, 1);
  }
};

export const setActivePlan = async (planId: string) => {
  const root = await getRoot();
  if (!root?.plans) return;
  root.plans.forEach(p => { if (p) p.$jazz.set("isActive", p.$jazz.id === planId) });
};

export const addDayToPlan = (plan: PlanWithRelations): string | undefined => {
  if (!plan.days) return;
  const newOrder = plan.days.length;
  const newDay = PlanDay.create({ name: `Day ${newOrder + 1}`, order: newOrder, exercises: [] }, { owner: plan.$jazz.owner });
  plan.days.$jazz.push(newDay);
  return newDay.$jazz.id;
};

export const duplicateDayInPlan = (plan: PlanWithRelations, dayIdToCopy: string): string | undefined => {
    if (!plan.days) return;

    const dayIndexToCopy = plan.days.findIndex(d => d?.$jazz.id === dayIdToCopy);
    const dayToCopy = plan.days[dayIndexToCopy];
    if (dayIndexToCopy === -1 || !dayToCopy) return;

    const newDay = PlanDay.create({
        name: `${dayToCopy.name} ${i18n.t('database.copy')}`,
        order: dayIndexToCopy + 1,
        exercises: co.list(PlanExercise).create(
            (dayToCopy.exercises || [])
            .filter((ex): ex is PlanExerciseResolved => !!ex)
            .map(ex => {
                return PlanExercise.create({
                    order: ex.order,
                    name: ex.name,
                    type: ex.type,
                    templateId: ex.templateId,
                    targetSets: ex.targetSets,
                    targetReps: ex.targetReps,
                    restBetweenSets: ex.restBetweenSets
                }, { owner: plan.$jazz.owner });
            })
        )
    }, { owner: plan.$jazz.owner });

    plan.days.$jazz.splice(dayIndexToCopy + 1, 0, newDay);
    
    plan.days.forEach((d, i) => { if (d) d.$jazz.set("order", i) });

    return newDay.$jazz.id;
};

export const updateDayInPlan = (day: PlanDayWithRelations, updates: Partial<Pick<PlanDayWithRelations, 'order' | 'name' | 'exercises'>>) => {
  const keys = Object.keys(updates) as (keyof typeof updates)[];
  keys.forEach(key => {
    const value = updates[key];
    if (value !== undefined) {
      day.$jazz.set(key, value);
    }
  });
};

export const deleteDayFromPlan = (plan: PlanWithRelations, dayId: string) => {
  const dayList = plan.days;
  if (!dayList) return;
  const index = dayList.findIndex(d => d?.$jazz.id === dayId);
  if (index > -1) {
    dayList.$jazz.splice(index, 1);
    dayList.forEach((d, i) => { if (d) d.$jazz.set("order", i) });
  }
};

export const reorderDaysInPlan = (plan: PlanWithRelations, sourceId: string, targetId: string, closestEdge: 'top' | 'bottom') => {
  if (!plan.days) return;
  const startIndex = plan.days.findIndex(d => d?.$jazz.id === sourceId);
  const targetIndex = plan.days.findIndex(d => d?.$jazz.id === targetId);
  if (startIndex === -1 || targetIndex === -1) return;
  const reordered = reorderWithEdge({ list: [...plan.days], startIndex, indexOfTarget: targetIndex, closestEdgeOfTarget: closestEdge, axis: 'vertical' });
  plan.days.$jazz.splice(0, plan.days.length, ...reordered.map((day, index) => {
        if (day) day.$jazz.set("order", index);
        return day;
      }));
};

export const addExerciseToPlanDay = async (day: PlanDayWithRelations, templateId: string) => {
  const root = await getRoot();
  if (!root || !day.exercises) return;
  
  const defaultSets = root.settings?.defaultPlanSettings?.sets ?? 3;
  const defaultReps = root.settings?.defaultPlanSettings?.reps ?? 10;
  
  const libraryEntry = masterLibrary[templateId];
  const customEntry = root.customExercises?.[templateId];

  if (libraryEntry || customEntry) {
    const newExercise = PlanExercise.create({
      templateId,
      type: ExerciseType.Sets,
      order: day.exercises.length,
      targetSets: defaultSets,
      targetReps: defaultReps,
    }, { owner: day.$jazz.owner });
    day.exercises.$jazz.push(newExercise);
  }
};

export const updateExerciseInPlanDay = (exercise: PlanExerciseResolved, updates: Partial<Pick<PlanExerciseResolved, 'order' | 'type' | 'templateId' | 'name' | 'restBetweenSets' | 'weightUnit' | 'targetSets' | 'targetReps' | 'sideType'>>) => {
  const keys = Object.keys(updates) as (keyof typeof updates)[];
  keys.forEach(key => {
    const value = updates[key];
    if (value !== undefined) {
      exercise.$jazz.set(key, value);
    }
  });
};

export const deleteExerciseFromPlanDay = (day: PlanDayWithRelations, exerciseId: string) => {
  if (!day.exercises) return;
  const index = day.exercises.findIndex(e => e?.$jazz.id === exerciseId);
  if (index > -1) {
    day.exercises.$jazz.splice(index, 1);
    day.exercises.forEach((ex, i) => { if (ex) ex.$jazz.set("order", i) });
  }
};

export const reorderExercisesInPlanDay = (day: PlanDayWithRelations, sourceId: string, targetId: string, closestEdge: 'top' | 'bottom') => {
  if (!day.exercises) return;
  const startIndex = day.exercises.findIndex(e => e?.$jazz.id === sourceId);
  const targetIndex = day.exercises.findIndex(e => e?.$jazz.id === targetId);
  if (startIndex === -1 || targetIndex === -1) return;
  const reordered = reorderWithEdge({ list: [...day.exercises], startIndex, indexOfTarget: targetIndex, closestEdgeOfTarget: closestEdge, axis: 'vertical' });
  day.exercises.$jazz.splice(0, day.exercises.length, ...reordered.map((ex, i) => {
        if (ex) ex.$jazz.set("order", i);
        return ex;
      }));
};

export const swapExerciseInPlanDay = async (
  day: PlanDayWithRelations,
  oldExerciseId: string,
  newExerciseTemplateId: string,
) => {
  const root = await getRoot();
  if (!root || !day.exercises) return;

  const oldExerciseIndex = day.exercises.findIndex(e => e?.$jazz.id === oldExerciseId);
  const oldExercise = day.exercises[oldExerciseIndex];
  if (oldExerciseIndex === -1 || !oldExercise) return;

  const libraryEntry = masterLibrary[newExerciseTemplateId];
  const customEntry = root.customExercises?.[newExerciseTemplateId];
  
  if (libraryEntry || customEntry) {
    const newExercise = PlanExercise.create({
      templateId: newExerciseTemplateId,
      type: ExerciseType.Sets,
      order: oldExercise.order,
      targetSets: oldExercise.targetSets,
      targetReps: oldExercise.targetReps,
      restBetweenSets: oldExercise.restBetweenSets,
      weightUnit: oldExercise.weightUnit,
    }, { owner: day.$jazz.owner });

    day.exercises.$jazz.splice(oldExerciseIndex, 1, newExercise);
  }
};

export const startWorkoutFromPlanDay = async (plan: PlanWithRelations, dayId: string) => {
  const day = plan.days?.find(d => d?.$jazz.id === dayId);
  if (!day) return null;
  
  const me = await WorkoutAppAccount.getMe();
  const { root } = await me.$jazz.ensureLoaded({
      resolve: {
        root: {
          sessions: { $each: { exercises: { $each: { sets: { $each: true } } } } },
          settings: { defaultPlanSettings: true },
          exerciseNotes: true,
          customExercises: { $each: true }
        }
      }
    });

  if (!root) return null;
  if (!root.sessions) root.$jazz.set("sessions", co.list(Session).create([]));

  const defaultRir = root.settings?.defaultPlanSettings?.rir;
  const globalRestTimer = root.settings?.globalRestTimer ?? 90;

  const newSession = Session.create({
    planId: plan.$jazz.id,
    dayId,
    name: day.name,
    startTime: new Date(),
    exercises: (day.exercises || []).filter((ex): ex is PlanExerciseResolved => !!ex).map(planEx => {
      const lastPerformanceForExercise = planEx.templateId 
        ? findLastPerformanceForExercise(root.sessions ? [...root.sessions] : [], planEx.templateId, undefined, new Date()) 
        : undefined;

      return Exercise.create({
        order: planEx.order,
        name: planEx.name,
        type: planEx.type,
        templateId: planEx.templateId,
        weightUnit: planEx.weightUnit,
        restBetweenSets: planEx.restBetweenSets ?? globalRestTimer,
        sets: Array.from({ length: planEx.targetSets ?? 1 }, (_, i) => {
          let weightToSet: number | undefined = undefined;

          if (lastPerformanceForExercise?.sets && lastPerformanceForExercise.sets.length > 0) {
            const lastSets = lastPerformanceForExercise.sets.filter((s): s is SetResolved => !!s);
            if(lastSets.length > 0) {
              if (i < lastSets.length) {
                weightToSet = lastSets[i]?.weight;
              } else {
                const lastAvailableSet = lastSets[lastSets.length - 1];
                weightToSet = lastAvailableSet?.weight;
              }
            }
          }

          let side: 'left' | 'right' | undefined = undefined;
          switch (planEx.sideType) {
              case 'unilateral_left':
                  side = 'left';
                  break;
              case 'unilateral_right':
                  side = 'right';
                  break;
              case 'unilateral_alternating':
                  side = i % 2 === 0 ? 'left' : 'right';
                  break;
          }

          return WorkoutSet.create({
            order: i,
            status: 'todo',
            reps: planEx.targetReps,
            rir: defaultRir,
            weight: weightToSet,
            side,
          });
        })
      });
    })
  });
  root.sessions.$jazz.push(newSession);
  return newSession.$jazz.id;
};

export const startQuickWorkout = async () => {
  const root = await getRoot();
  if (!root?.sessions) return null;
  const newSession = Session.create({ name: i18n.t('database.quickWorkout'), startTime: new Date(), exercises: [] });
  root.sessions.$jazz.push(newSession);
  return newSession.$jazz.id;
};

export const endCurrentWorkoutWithEndTime = async (session: SessionWithRelations, endTime: Date) => {
  session.$jazz.set("endTime", endTime);
  session.$jazz.set("completedAt", endTime);
  await clearRestTimer();
};

export const endCurrentWorkout = async (session: SessionWithRelations) => {
  await endCurrentWorkoutWithEndTime(session, new Date());
};

export const addExerciseToSession = async (session: SessionWithRelations, templateId: string) => {
  const me = await WorkoutAppAccount.getMe();
  const { root } = await me.$jazz.ensureLoaded({
      resolve: {
        root: {
          sessions: { $each: { exercises: { $each: { sets: { $each: true } } } } },
          settings: { defaultPlanSettings: true },
          customExercises: { $each: true },
          exerciseNotes: true
        }
      }
    });

  if (!root || !session.exercises) return;

  const lastPerformance = templateId 
    ? findLastPerformanceForExercise(root.sessions ? [...root.sessions] : [], templateId, session.$jazz.id, new Date())
    : undefined;

  const defaultSets = root.settings?.defaultPlanSettings?.sets ?? 3;
  const defaultReps = root.settings?.defaultPlanSettings?.reps ?? 10;
  const defaultRir = root?.settings?.defaultPlanSettings?.rir;
  const globalRestTimer = root.settings?.globalRestTimer ?? 90;

  const libraryEntry = masterLibrary[templateId];
  const customEntry = root.customExercises?.[templateId];

  if (libraryEntry || customEntry) {
    const newExercise = Exercise.create({
      templateId,
      type: ExerciseType.Sets,
      order: session.exercises.length,
      restBetweenSets: globalRestTimer,
      sets: Array.from({ length: defaultSets }, (_, i) => {
        let weightToSet: number | undefined = undefined;
        if (lastPerformance?.sets && lastPerformance.sets.length > 0) {
          const lastSets = lastPerformance.sets.filter((s): s is SetResolved => !!s);
          if (lastSets.length > 0) {
            if (i < lastSets.length) {
              weightToSet = lastSets[i]?.weight;
            } else {
              const lastAvailableSet = lastSets[lastSets.length - 1];
              weightToSet = lastAvailableSet?.weight;
            }
          }
        }
        return WorkoutSet.create({
            order: i,
            status: 'todo',
            reps: defaultReps,
            rir: defaultRir,
            weight: weightToSet,
        });
      }),
    });
    session.exercises.$jazz.push(newExercise);
  }
};

export const updateExercise = (exercise: ExerciseWithRelations, updates: Partial<Pick<ExerciseWithRelations, 'order' | 'type' | 'templateId' | 'name' | 'restBetweenSets' | 'weightUnit' | 'trackingOverrides'>>) => {
  const keys = Object.keys(updates) as (keyof typeof updates)[];
  keys.forEach(key => {
    const value = updates[key];
    if (value !== undefined) {
      exercise.$jazz.set(key, value);
    }
  });
};

export const deleteExerciseFromSession = (session: SessionWithRelations, exerciseId: string) => {
  if (!session.exercises) return;
  const index = session.exercises.findIndex(e => e?.$jazz.id === exerciseId);
  if (index > -1) session.exercises.$jazz.splice(index, 1);
};

export const reorderExercisesInSession = (session: SessionWithRelations, sourceId: string, targetId: string, closestEdge: 'top' | 'bottom') => {
  if (!session.exercises) return;
  const startIndex = session.exercises.findIndex(e => e?.$jazz.id === sourceId);
  const targetIndex = session.exercises.findIndex(e => e?.$jazz.id === targetId);
  if (startIndex === -1 || targetIndex === -1) return;
  const reordered = reorderWithEdge({ list: [...session.exercises], startIndex, indexOfTarget: targetIndex, closestEdgeOfTarget: closestEdge, axis: 'vertical' });
  session.exercises.$jazz.splice(0, session.exercises.length, ...reordered.map((ex, i) => {
        if (ex) ex.$jazz.set("order", i);
        return ex;
      }));
};

export const addSetToSession = async (exercise: ExerciseWithRelations) => {
  if (!exercise.sets) return;

  const root = await getRoot();
  const defaultReps = root?.settings?.defaultPlanSettings?.reps ?? 10;
  const defaultRir = root?.settings?.defaultPlanSettings?.rir;

  const lastSet = exercise.sets[exercise.sets.length - 1];
  const newSet = WorkoutSet.create({
    order: exercise.sets.length,
    status: 'todo',
    reps: lastSet?.reps ?? defaultReps,
    weight: lastSet?.weight ?? 0,
    rir: lastSet?.rir ?? defaultRir,
  });
  exercise.sets.$jazz.push(newSet);
};

export const deleteLastSetFromSession = (exercise: ExerciseWithRelations) => {
  if (!exercise.sets || exercise.sets.length === 0) return;
  exercise.sets.$jazz.splice(exercise.sets.length - 1, 1);
};

export const updateSet = (set: SetResolved, updates: Partial<Pick<SetResolved, 'order' | 'status' | 'reps' | 'weight' | 'duration' | 'distance' | 'rir'>>) => {
  const keys = Object.keys(updates) as (keyof typeof updates)[];
  keys.forEach(key => {
    const value = updates[key];
    if (value !== undefined) {
      set.$jazz.set(key, value);
    }
  });
};

export const deleteSetFromSession = (exercise: ExerciseWithRelations, setId: string) => {
  if (!exercise.sets) return;
  const index = exercise.sets.findIndex(s => s?.$jazz.id === setId);
  if (index > -1) {
    exercise.sets.$jazz.splice(index, 1);
    exercise.sets.forEach((s, i) => { if (s) s.$jazz.set("order", i) });
  }
};

export const reorderSetsInSession = (exercise: ExerciseWithRelations, sourceId: string, targetId: string, closestEdge: 'top' | 'bottom') => {
  if (!exercise.sets) return;
  const startIndex = exercise.sets.findIndex(s => s?.$jazz.id === sourceId);
  const targetIndex = exercise.sets.findIndex(s => s?.$jazz.id === targetId);
  if (startIndex === -1 || targetIndex === -1) return;
  const reordered = reorderWithEdge({ list: [...exercise.sets], startIndex, indexOfTarget: targetIndex, closestEdgeOfTarget: closestEdge, axis: 'vertical' });
  exercise.sets.$jazz.splice(0, exercise.sets.length, ...reordered.map((s, i) => {
        if (s) s.$jazz.set("order", i);
        return s;
      }));
};

export const updateCustomExercise = async (exerciseId: string, updates: Partial<Pick<CustomExerciseResolved, 'name' | 'bodyPart' | 'equipment' | 'primaryMuscleKeys' | 'secondaryMuscleKeys' | 'instructions' | 'notes'>>) => {
    const root = await getRoot();
    if (!root?.customExercises?.[exerciseId]) {
        console.error("Custom exercise not found for update:", exerciseId);
        return;
    }
    const exercise = root.customExercises[exerciseId];
    const keys = Object.keys(updates) as (keyof typeof updates)[];
    keys.forEach(key => {
        const value = updates[key];
        if (value !== undefined) {
            exercise.$jazz.set(key, value);
        }
    });
};

export const toggleCustomExercisePublic = async (exerciseId: string, makePublic: boolean) => {
    const root = await getRoot();
    const exercise = root?.customExercises?.[exerciseId];
    if (exercise) {
        const group = exercise.$jazz.owner;
        makePublic ? group.makePublic('reader') : group.removeMember("everyone");
    }
};

export const deleteCustomExercise = async (exerciseId: string) => {
    const root = await getRoot();
    if (!root?.customExercises?.[exerciseId]) return;
    root.customExercises.$jazz.delete(exerciseId);
};

export const duplicateCustomExercise = async (exerciseId: string) => {
    const root = await getRoot();
    if (!root?.customExercises?.[exerciseId]) return;

    const exerciseToCopy = root.customExercises[exerciseId];
    
    await exerciseToCopy.$jazz.ensureLoaded({
            resolve: { primaryMuscleKeys: true, secondaryMuscleKeys: true, instructions: true }
        });

    const newExercise = CustomExercise.create({
        name: `${exerciseToCopy.name} ${i18n.t('database.copy')}`,
        bodyPart: exerciseToCopy.bodyPart,
        equipment: exerciseToCopy.equipment,
        primaryMuscleKeys: co.list(z.string()).create(exerciseToCopy.primaryMuscleKeys?.slice() || []),
        secondaryMuscleKeys: co.list(z.string()).create(exerciseToCopy.secondaryMuscleKeys?.slice() || []),
        instructions: co.list(z.string()).create(exerciseToCopy.instructions?.slice() || []),
        compound: exerciseToCopy.compound,
    });

    root.customExercises.$jazz.set(newExercise.$jazz.id, newExercise);
};

export const createCustomExercise = async (exerciseData: Omit<TExerciseLibraryItem, 'id'>) => {
  const root = await getRoot();
  if (!root?.customExercises) return '';
  const newExercise = CustomExercise.create({
    name: exerciseData.name,
    bodyPart: exerciseData.bodyPart,
    equipment: exerciseData.equipment,
    primaryMuscleKeys: exerciseData.primaryMuscles,
    secondaryMuscleKeys: exerciseData.secondaryMuscles,
    instructions: exerciseData.instructions || [],
    compound: exerciseData.compound ?? false,
  });
  root.customExercises.$jazz.set(newExercise.$jazz.id, newExercise);
  return newExercise.$jazz.id;
};

export const deleteSession = async (sessionId: string) => {
    const root = await getRoot();
    if (!root?.sessions) return;
    const index = root.sessions.findIndex(s => s?.$jazz.id === sessionId);
    if (index > -1) {
        root.sessions.$jazz.splice(index, 1);
    }
};

export const restartWorkout = async (session: SessionWithRelations) => {
  const root = await getRoot();
  if (!root?.sessions) return null;

  const newSession = Session.create({
    planId: session.planId,
    dayId: session.dayId,
    name: session.name,
    startTime: new Date(),
    exercises: (session.exercises || []).filter((ex): ex is ExerciseWithRelations => !!ex).map(oldEx => {
      return Exercise.create({
        order: oldEx.order,
        name: oldEx.name,
        type: oldEx.type,
        templateId: oldEx.templateId,
        restBetweenSets: oldEx.restBetweenSets ?? 60,
        sets: (oldEx.sets || []).filter((set): set is SetResolved => !!set).map(oldSet => WorkoutSet.create({
          order: oldSet.order,
          status: 'todo',
          reps: oldSet.reps,
          weight: oldSet.weight,
          duration: oldSet.duration,
          distance: oldSet.distance,
        }))
      });
    })
  });

  root.sessions.$jazz.push(newSession);
  return newSession.$jazz.id;
};

export const createPlanFromSession = async (session: SessionWithRelations) => {
    const root = await getRoot();
    if (!root?.plans) return null;

    const newPlan = Plan.create({
        name: `${session.name} Plan`,
        isActive: false,
        days: [
            PlanDay.create({
                name: "Workout Day 1",
                order: 0,
                exercises: (session.exercises || []).filter((ex): ex is ExerciseWithRelations => !!ex).map((sessionEx, index) => {
                    const firstCompletedSet = sessionEx.sets.find(s => s?.status === 'completed');
                    return PlanExercise.create({
                        order: index,
                        name: sessionEx.name,
                        type: sessionEx.type,
                        templateId: sessionEx.templateId,
                        targetSets: sessionEx.sets.length,
                        targetReps: firstCompletedSet?.reps ?? 10,
                    });
                })
            })
        ]
    });
    
    root.plans.$jazz.push(newPlan);
    return newPlan.$jazz.id;
};

export const swapExerciseInSession = async (
  session: SessionWithRelations,
  oldExerciseId: string,
  newExerciseTemplateId: string,
) => {
  const root = await getRoot();
  if (!root || !session.exercises) return;

  const oldExerciseIndex = session.exercises.findIndex(e => e?.$jazz.id === oldExerciseId);
  const oldExercise = session.exercises[oldExerciseIndex];
  if (oldExerciseIndex === -1 || !oldExercise) return;

  const defaultSets = root.settings?.defaultPlanSettings?.sets ?? 3;
  const defaultReps = root.settings?.defaultPlanSettings?.reps ?? 10;
  const defaultRir = root.settings?.defaultPlanSettings?.rir;
  const globalRestTimer = root.settings?.globalRestTimer ?? 90;

  const libraryEntry = masterLibrary[newExerciseTemplateId];
  const customEntry = root.customExercises?.[newExerciseTemplateId];
  
  if (libraryEntry || customEntry) {
    const newExercise = Exercise.create({
      templateId: newExerciseTemplateId,
      type: ExerciseType.Sets,
      order: oldExercise.order,
      restBetweenSets: globalRestTimer,
      sets: Array.from({ length: defaultSets }, (_, i) =>
        WorkoutSet.create({
          order: i,
          status: 'todo',
          reps: defaultReps,
          rir: defaultRir,
        }),
      ),
    });

    session.exercises.$jazz.splice(oldExerciseIndex, 1, newExercise);
  }
};

export const updateWeightUnitForExerciseHistory = async (templateId: string, newUnit: 'kg' | 'lbs') => {
    const me = await WorkoutAppAccount.getMe();
    const { root } = await me.$jazz.ensureLoaded({
            resolve: {
                root: {
                    settings: true,
                    plans: { $each: { days: { $each: { exercises: { $each: true } } } } },
                    sessions: { $each: { exercises: { $each: { sets: { $each: true } } } } }
                }
            }
        });

    if (!root) return;

    const globalDefaultUnit = root.settings?.weightUnit ?? 'kg';

    if (root.sessions) {
        for (const session of root.sessions) {
            if (!session?.exercises) continue;

            for (const exercise of session.exercises) {
                if (exercise?.templateId === templateId) {
                    const oldUnit = exercise.weightUnit || globalDefaultUnit;

                    if (oldUnit !== newUnit) {
                        for (const set of exercise.sets) {
                            if (set?.weight !== undefined && set.weight !== null && set.weight > 0) {
                                const weightInKg = set.weight;
                                const displayedValue = convertKgToDisplay(weightInKg, oldUnit);
                                const newWeightInKg = convertDisplayToKg(displayedValue, newUnit);
                                set.$jazz.set("weight", newWeightInKg);
                            }
                        }
                    }
                    
                    exercise.$jazz.set("weightUnit", newUnit);
                }
            }
        }
    }

    if (root.plans) {
        for (const plan of root.plans) {
            for (const day of plan?.days || []) {
                for (const exercise of day?.exercises || []) {
                    if (exercise?.templateId === templateId) {
                        exercise.$jazz.set("weightUnit", newUnit);
                    }
                }
            }
        }
    }

    console.log(`Updated unit to ${newUnit.toUpperCase()} for exercise ${templateId} across all history and plans.`);
};