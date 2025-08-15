import type { SessionWithRelations, SetResolved, SettingsResolved } from '@/jazz/db';
import { convertKgToDisplay } from './utils';
import i18n from '@/i18n';

interface SetData { reps: number; weight: number; rir?: number | null; }
interface ExerciseData { name: string; sets: SetData[]; }
interface ProgressionPlan {
  repRange: { min: number; max: number };
  rir: number; 
  weightIncrement: number;
}
export interface Progression {
  suggestion: string;
  nextWorkoutPlan: { weight: number; reps: number; rir: number; }[];
}

function getSmartWeightIncrement(equipment: string, unit: 'kg' | 'lbs'): number {
    const isLbs = unit === 'lbs';
    const equipmentType = equipment.toLowerCase();

    if (equipmentType.includes('barbell') || equipmentType.includes('smith') || equipmentType.includes('trap bar') || equipmentType.includes('sled')) {
        return isLbs ? 5 : 2.5;
    }
    if (equipmentType.includes('dumbbell') || equipmentType.includes('kettlebell')) {
        return isLbs ? 2.5 : 1.25;
    }
    if (equipmentType.includes('machine') || equipmentType.includes('cable')) {
        return isLbs ? 5 : 2.5;
    }
    return isLbs ? 2.5 : 1.25; 
}

function analyzeExercise(
    lastPerformance: ExerciseData | undefined,
    plan: ProgressionPlan,
    unit: 'kg' | 'lbs',
    t: (key: string) => string
): Progression {
    const targetSetCount = (lastPerformance?.sets?.length ?? 3);

    
    if (!lastPerformance?.sets?.length) {
        const startWeight = unit === 'lbs' ? 135 : 60;
        return {
            suggestion: t('progression.firstTime'),
            nextWorkoutPlan: Array(targetSetCount).fill({
                weight: startWeight,
                reps: plan.repRange.min,
                rir: plan.rir,
            }),
        };
    }

    const lastSets = lastPerformance.sets;
    const lastWeight = lastSets[0].weight;
    
    
    const allSetsMetMinReps = lastSets.every(s => s.reps >= plan.repRange.min);
    const allSetsMetMaxReps = lastSets.every(s => s.reps >= plan.repRange.max);
    const allSetsMetTargetRIR = lastSets.every(s => (s.rir ?? plan.rir) >= plan.rir);

    
    
    if (allSetsMetMaxReps && allSetsMetTargetRIR) {
        const nextWeight = lastWeight + plan.weightIncrement;
        return {
            suggestion: t('progression.masteredWeight'),
            nextWorkoutPlan: Array(targetSetCount).fill({
                weight: nextWeight,
                reps: plan.repRange.min,
                rir: plan.rir,
            }),
        };
    }

    
    
    if (allSetsMetMinReps && allSetsMetTargetRIR) {
        const currentTopRep = Math.max(...lastSets.map(s => s.reps));
        const nextReps = Math.min(currentTopRep + 1, plan.repRange.max);
        return {
            suggestion: t('progression.standardProgress'),
            nextWorkoutPlan: Array(targetSetCount).fill({
                weight: lastWeight,
                reps: nextReps,
                rir: plan.rir,
            }),
        };
    }

    
    
    if (allSetsMetMinReps && !allSetsMetTargetRIR) {
        const lastReps = Math.max(...lastSets.map(s => s.reps));
         return {
            suggestion: t('progression.highEffort'),
            nextWorkoutPlan: Array(targetSetCount).fill({
                weight: lastWeight,
                reps: lastReps,
                rir: plan.rir,
            }),
        };
    }

    
    
    const deloadWeight = Math.max(0, lastWeight - plan.weightIncrement);
    const midRepTarget = Math.round((plan.repRange.min + plan.repRange.max) / 2);
    return {
        suggestion: t('progression.plateau'),
        nextWorkoutPlan: Array(targetSetCount).fill({
            weight: deloadWeight,
            reps: midRepTarget,
            rir: plan.rir,
        }),
    };
}

export function generateProgressionForExercise(
    exerciseTemplateId: string,
    exerciseEquipment: string,
    allSessions: SessionWithRelations[],
    settings: SettingsResolved,
): (Progression & { planUnit: 'kg' | 'lbs' }) | null {
    if (!settings.progressionEnabled) {
        return null;
    }

    const unit = settings.weightUnit ?? 'kg';
    const override = settings.progressionOverrides?.[exerciseTemplateId];
    const activeSettings = override ?? settings.defaultProgressionSettings;
    if (!activeSettings) return null;

    const repRange = {
        min: activeSettings.repRangeMin,
        max: activeSettings.repRangeMax,
    };

    const weightIncrement = getSmartWeightIncrement(exerciseEquipment, unit);
    const targetRir = activeSettings.rir ?? settings.defaultProgressionSettings?.rir ?? 2;
    
    const progressionPlan: ProgressionPlan = { repRange, rir: targetRir, weightIncrement };

    let lastPerformance: ExerciseData | undefined = undefined;
    const sortedSessions = [...allSessions].sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

    for (const session of sortedSessions) {
        const exerciseInstance = session.exercises?.find(ex => ex?.templateId === exerciseTemplateId);
        if (exerciseInstance) {
            const completedSets = exerciseInstance.sets
                .filter((s): s is SetResolved => s?.status === 'completed' && s.weight != null && s.weight > 0 && s.reps != null && s.reps > 0);

            if (completedSets.length > 0) {
                lastPerformance = {
                    name: exerciseInstance.name || i18n.t('common.exercise'),
                    sets: completedSets.map(s => ({
                        weight: convertKgToDisplay(s.weight!, unit),
                        reps: s.reps!,
                        rir: s.rir
                    })),
                };
                break;
            }
        }
    }
    
    const progression = analyzeExercise(lastPerformance, progressionPlan, unit, i18n.t);
    return { ...progression, planUnit: unit };
}