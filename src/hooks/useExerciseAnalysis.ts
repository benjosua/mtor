import { useAccountSelector } from "@/components/AccountProvider";
import { masterLibrary } from "@/data/master-library";
import {
    findLastPerformanceForExercise,
    useCustomExercises,
    useSettings,
    type CustomExerciseResolved,
    type ExerciseWithRelations,
    type SessionWithRelations,
    type SetResolved
} from "@/jazz/db";
import { calculateEpley1RM, getWeightForReps } from "@/lib/analysis";
import { generateProgressionForExercise } from "@/lib/progression";
import type { TExerciseLibraryItem } from "@/lib/types";
import { useMemo } from "react";

export function useExerciseAnalysis(exercise: ExerciseWithRelations, session: SessionWithRelations) {
    const sessions = useAccountSelector({
        select: (me) => me.root?.sessions ? [...me.root.sessions] : []
    });
    const { settings } = useSettings();
    const { customExercises } = useCustomExercises();

    const lastPerformance = useMemo(() => {
        if (!sessions || !exercise.templateId) {
            return null;
        }

        const pointInTime = session.completedAt ? new Date(session.completedAt) : new Date();

        return findLastPerformanceForExercise(
            sessions,
            exercise.templateId,
            session.$jazz.id,
            pointInTime
        );
    }, [sessions, exercise.templateId, session.$jazz.id, session.completedAt]);

    const libraryDetails = useMemo(() => {
        if (!exercise.templateId) return null;
        const mappedCustomExercises: TExerciseLibraryItem[] = (customExercises || [])
            .filter(Boolean)
            .map((ex: CustomExerciseResolved) => {
                
                const rawPrimaryKeys = (ex as any).primaryMuscleKeys || [(ex as any).target];
                const rawSecondaryKeys = (ex as any).secondaryMuscleKeys || (ex as any).secondaryMuscles || [];

                const primaryKeys = (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
                const secondaryKeys = (Array.isArray(rawSecondaryKeys) ? rawSecondaryKeys : [rawSecondaryKeys]).filter((key): key is string => Boolean(key));

                return {
                    id: ex.$jazz.id,
                    name: ex.name,
                    bodyPart: ex.bodyPart,
                    equipment: ex.equipment,
                    target: primaryKeys[0] || 'N/A',
                    primaryMuscles: primaryKeys,
                    secondaryMuscles: secondaryKeys,
                    instructions: ex.instructions?.slice() || [],
                };
            });
        const masterExercises: TExerciseLibraryItem[] = Object.entries(masterLibrary).map(([id, ex]) => ({
            id,
            name: ex.name.en,
            bodyPart: ex.bodyPartKey,
            equipment: ex.equipmentKey,
            target: ex.primaryMuscleKeys[0] || 'N/A',
            primaryMuscles: ex.primaryMuscleKeys.slice(),
            secondaryMuscles: ex.secondaryMuscleKeys.slice(),
            instructions: ex.instructions.en,
        }));

        const fullLibrary: TExerciseLibraryItem[] = [...masterExercises, ...mappedCustomExercises];
        return fullLibrary.find(libEx => libEx.id === exercise.templateId);
    }, [exercise.templateId, customExercises]);

    const progression = useMemo(() => {
        if (!exercise.templateId || !sessions || !settings) {
            return null;
        }
        const equipment = libraryDetails?.equipment ?? 'barbell';

        return generateProgressionForExercise(
            exercise.templateId,
            equipment,
            sessions,
            settings
        );
    }, [sessions, settings, exercise, libraryDetails]);

    const lastPerformanceBests = useMemo(() => {
        if (!lastPerformance) {
            return { best1rm: 0, best10rm: 0 };
        }

        let best1rm = 0;
        const completedSets = (lastPerformance.sets || []).filter(
            (s): s is SetResolved =>
                s?.status === "completed" &&
                typeof s.weight === "number" && s.weight > 0 &&
                typeof s.reps === "number" && s.reps > 0
        );

        for (const set of completedSets) {
            const currentE1rm = calculateEpley1RM(set.weight!, set.reps!, set.rir ?? 0);
            if (currentE1rm > best1rm) {
                best1rm = currentE1rm;
            }
        }
        
        const best10rm = best1rm > 0 ? getWeightForReps(best1rm, 10) : 0;

        return { best1rm, best10rm };

    }, [lastPerformance]);

    return { lastPerformance, progression, libraryDetails, lastPerformanceBests };
}