import { masterLibrary } from '@/data/master-library';
import type { CustomExerciseResolved, PlanWithRelations, SessionWithRelations } from '@/jazz/db';
import type { TFunction } from 'i18next';
import { specificToGeneralMuscleMap } from './muscleUtils';

export interface MuscleGroupAnalysis {
  totalWeeklySets: number;
  primarySets: number;
  secondarySetsUnweighted: number;
  secondarySetsWeighted: number;
  frequency: number;
  maxSetsInOneSession: number;
  sessionsInCycle: { dayIndex: number; totalSets: number }[];
  distributionRating: 'good' | 'concentrated' | 'inefficient';
  recoveryRating: 'good' | 'at_risk' | 'poor';
  suggestion: string;
  suggestionLevel: 'good' | 'info' | 'warning';
  specificPrimary: string[];
  specificSecondary: string[];
}

export type PlanAnalysis = Record<string, MuscleGroupAnalysis>;

const getRequiredRecoveryDays = (sets: number): number => {
    if (sets >= 8) return 4;
    if (sets >= 6) return 3;
    if (sets >= 4) return 2;
    if (sets >= 1) return 1;
    return 0;
};

const createDefaultAnalysis = (groupKey: string, t: TFunction): MuscleGroupAnalysis => ({
    totalWeeklySets: 0,
    primarySets: 0,
    secondarySetsUnweighted: 0,
    secondarySetsWeighted: 0,
    frequency: 0,
    maxSetsInOneSession: 0,
    sessionsInCycle: [],
    distributionRating: 'good',
    recoveryRating: 'good',
    suggestion: t('planAnalysis.notTrained', { groupName: t(`generalMuscles.${groupKey}`) }),
    suggestionLevel: 'info',
    specificPrimary: [],
    specificSecondary: [],
});

export function analyzePlanVolume(
  plan: PlanWithRelations,
  customExercises: CustomExerciseResolved[],
  sessionsHistory: SessionWithRelations[],
  t: TFunction
): PlanAnalysis {
  const muscleGroupData: Record<string, {
    primarySets: number;
    secondarySetsUnweighted: number;
    secondarySetsWeighted: number;
    sessions: Map<number, { primary: number, secondaryWeighted: number }>;
    specificPrimary: Set<string>;
    specificSecondary: Set<string>;
  }> = {};

  const getExerciseDetails = (templateId: string): { primary: readonly string[], secondary: readonly string[] } | null => {
    const libraryEntry = masterLibrary[templateId];
    if (libraryEntry) {
      return { primary: libraryEntry.primaryMuscleKeys, secondary: libraryEntry.secondaryMuscleKeys };
    }
    const customEntry = customExercises.find(ex => ex.$jazz.id === templateId);
    if (customEntry) {
        const primary = (customEntry as any).primaryMuscleKeys || ((customEntry as any).target ? [(customEntry as any).target] : []);
        const secondary = (customEntry as any).secondaryMuscleKeys || (customEntry as any).secondaryMuscles || [];
        return {
            primary: Array.isArray(primary) ? primary : [primary],
            secondary: Array.isArray(secondary) ? secondary : [secondary]
        };
    }
    return null;
  };

  plan.days?.forEach((day, dayIndex) => {
    if (!day) return;
    (day.exercises || [])?.forEach(exercise => {
      if (!exercise || !exercise.templateId) return;
      const details = getExerciseDetails(exercise.templateId);
      if (!details) return;
      const sets = exercise.targetSets ?? 0;
      if (sets === 0) return;

      const processedGeneralGroupsThisExercise = new Set<string>();

      const processMuscle = (muscleKey: string, isPrimary: boolean) => {
        const generalGroup = specificToGeneralMuscleMap[muscleKey];
        if (!generalGroup || generalGroup === 'cardio') return;

        if (!muscleGroupData[generalGroup]) {
          muscleGroupData[generalGroup] = { primarySets: 0, secondarySetsUnweighted: 0, secondarySetsWeighted: 0, sessions: new Map(), specificPrimary: new Set(), specificSecondary: new Set() };
        }
        if (!muscleGroupData[generalGroup].sessions.has(dayIndex)) {
            muscleGroupData[generalGroup].sessions.set(dayIndex, { primary: 0, secondaryWeighted: 0 });
        }

        if (isPrimary) {
          muscleGroupData[generalGroup].specificPrimary.add(muscleKey);
        } else {
          muscleGroupData[generalGroup].specificSecondary.add(muscleKey);
        }

        if (processedGeneralGroupsThisExercise.has(generalGroup)) {
          return;
        }
        processedGeneralGroupsThisExercise.add(generalGroup);

        const session = muscleGroupData[generalGroup].sessions.get(dayIndex)!;
        if (isPrimary) {
            muscleGroupData[generalGroup].primarySets += sets;
            session.primary += sets;
        } else {
            muscleGroupData[generalGroup].secondarySetsUnweighted += sets;
            const weightedContribution = sets * 0.5;
            muscleGroupData[generalGroup].secondarySetsWeighted += weightedContribution;
            session.secondaryWeighted += weightedContribution;
        }
      };

      details.primary.forEach(key => processMuscle(key, true));
      details.secondary.forEach(key => processMuscle(key, false));
    });
  });

  const trainedAnalysis: PlanAnalysis = {};
  const totalDaysInPlan = plan.days?.length || 1;
  const weekMultiplier = totalDaysInPlan > 0 ? 7 / totalDaysInPlan : 1;

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentSessions = sessionsHistory.filter(s => s.completedAt && new Date(s.completedAt) > fourWeeksAgo);

  for (const group in muscleGroupData) {
    const data = muscleGroupData[group];

    const primarySetsPerCycle = data.primarySets;
    const secondarySetsWeightedPerCycle = data.secondarySetsWeighted;
    const totalSetsPerCycle = primarySetsPerCycle + secondarySetsWeightedPerCycle;

    if (totalSetsPerCycle < 1.5 && primarySetsPerCycle === 0) continue;

    const totalWeeklySets = Math.round(totalSetsPerCycle * weekMultiplier);
    const primarySets = Math.round(primarySetsPerCycle * weekMultiplier);
    const secondarySetsWeighted = Math.round(secondarySetsWeightedPerCycle * weekMultiplier);
    const secondarySetsUnweighted = Math.round(data.secondarySetsUnweighted * weekMultiplier);

    const sessionsInCycle = Array.from(data.sessions.entries())
      .map(([dayIndex, sets]) => ({ dayIndex, totalSets: Math.round(sets.primary + sets.secondaryWeighted) }))
      .sort((a, b) => a.dayIndex - b.dayIndex);

    const maxSetsInOneSession = Math.max(...sessionsInCycle.map(s => s.totalSets), 0);

    const sessionsTrainingGroup = new Set<string>();
    for (const session of recentSessions) {
        for (const exercise of session.exercises || []) {
            if (!exercise?.templateId) continue;
            const details = getExerciseDetails(exercise.templateId);
            if (!details) continue;

            const trainedThisSession = details.primary.some(p => specificToGeneralMuscleMap[p] === group);
            if (trainedThisSession) {
                sessionsTrainingGroup.add(session.$jazz.id);
                break;
            }
        }
    }
    const frequency = parseFloat((sessionsTrainingGroup.size / 4).toFixed(1));

    const frequencyPerCycle = sessionsInCycle.length;

    
    let recoveryRating: MuscleGroupAnalysis['recoveryRating'] = 'good';
    let recoveryProblem = '';
    if (frequencyPerCycle > 1) {
        for (let i = 0; i < sessionsInCycle.length; i++) {
            const currentSession = sessionsInCycle[i];
            const nextSession = sessionsInCycle[(i + 1) % sessionsInCycle.length];
            const daysBetween = i === sessionsInCycle.length - 1
                ? (totalDaysInPlan - currentSession.dayIndex) + nextSession.dayIndex
                : nextSession.dayIndex - currentSession.dayIndex;

            const requiredRecovery = getRequiredRecoveryDays(currentSession.totalSets);

            if (daysBetween < requiredRecovery) {
                
                recoveryRating = 'at_risk';
                recoveryProblem = t('planAnalysis.recoveryWarning', {
                    sets: currentSession.totalSets,
                    required: requiredRecovery,
                    actual: daysBetween,
                    groupName: t(`generalMuscles.${group}`)
                });
                break;
            }
        }
    }

    
    let suggestion = '';
    let suggestionLevel: MuscleGroupAnalysis['suggestionLevel'] = 'good';
    const groupName = t(`generalMuscles.${group}`);

    
    if (recoveryRating === 'at_risk') {
        suggestion = recoveryProblem;
        suggestionLevel = 'warning';
    
    } else if (maxSetsInOneSession >= 10) {
        suggestion = t('planAnalysis.highSessionVolume', { sets: maxSetsInOneSession, groupName });
        suggestionLevel = 'warning';
    
    } else if (frequency < 1.5 && totalWeeklySets > 8) { 
        suggestion = t('planAnalysis.lowFrequency', { freq: frequency, groupName });
        suggestionLevel = 'info';
    
    } else if (totalWeeklySets > 20) {
        suggestion = t('planAnalysis.highWeeklyVolume', { sets: totalWeeklySets, groupName });
        suggestionLevel = 'info';
    } else if (totalWeeklySets < 8 && totalWeeklySets > 0) { 
        suggestion = t('planAnalysis.lowWeeklyVolume', { sets: totalWeeklySets, groupName });
        suggestionLevel = 'info';
    } else {
        suggestion = t('planAnalysis.goodVolume', { groupName });
        suggestionLevel = 'good';
    }
    
    
    if (primarySets === 0 && secondarySetsWeighted > 0 && suggestionLevel === 'good') {
        suggestion = t('planAnalysis.indirectOnly', { groupName });
        suggestionLevel = 'info';
    }

    
    
    
    
    let distributionRating: MuscleGroupAnalysis['distributionRating'] = 'good';
    if (maxSetsInOneSession >= 8) distributionRating = 'inefficient';
    else if (maxSetsInOneSession >= 6) distributionRating = 'concentrated';

    const finalSpecificSecondary = new Set(data.specificSecondary);
    data.specificPrimary.forEach(p => finalSpecificSecondary.delete(p));

    trainedAnalysis[group] = {
      totalWeeklySets,
      primarySets,
      secondarySetsUnweighted,
      secondarySetsWeighted,
      frequency,
      maxSetsInOneSession,
      sessionsInCycle,
      distributionRating,
      recoveryRating,
      suggestion,
      suggestionLevel,
      specificPrimary: Array.from(data.specificPrimary).sort(),
      specificSecondary: Array.from(finalSpecificSecondary).sort(),
    };
  }
  
  const finalAnalysis: PlanAnalysis = { ...trainedAnalysis };
  
  const allMuscleGroups = [...new Set(Object.values(specificToGeneralMuscleMap))]
    .filter(group => group !== 'cardio' && group !== 'core'); 
  
  allMuscleGroups.forEach(groupKey => {
      if (!finalAnalysis[groupKey]) {
          finalAnalysis[groupKey] = createDefaultAnalysis(groupKey, t);
      }
  });

  return finalAnalysis;
}