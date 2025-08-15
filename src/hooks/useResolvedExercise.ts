import { masterLibrary } from "@/data/master-library";
import { useCustomExercises, useSettings, type ExerciseWithRelations, type PlanExerciseResolved } from "@/jazz/db";
import { getDisplayMuscleNames } from "@/lib/muscleUtils";
import type { TExerciseLibraryItem } from "@/lib/types";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function useResolvedExerciseDetails(
    exercise: ExerciseWithRelations | PlanExerciseResolved | { templateId?: string, name?: string } | undefined | null
): TExerciseLibraryItem | null {
    const { t, i18n } = useTranslation();
    const { customExercises } = useCustomExercises();
    const { settings } = useSettings();

    return useMemo(() => {
        if (!exercise?.templateId) return null;

        const displayDetailed = settings?.trackingSettings?.displayDetailedMuscles ?? false;
        const libraryEntry = masterLibrary[exercise.templateId];
        const customEntry = customExercises?.find(c => c.$jazz.id === exercise.templateId);

        let resolved: Partial<TExerciseLibraryItem> = {};

        if (libraryEntry) {
            const currentLang = i18n.language as 'en' | 'es' | 'de';
            const displayPrimary = getDisplayMuscleNames({ specificKeys: libraryEntry.primaryMuscleKeys, displayDetailed, t });
            const displaySecondary = getDisplayMuscleNames({ specificKeys: libraryEntry.secondaryMuscleKeys, displayDetailed, t });

            resolved = {
                name: libraryEntry.name[currentLang] || libraryEntry.name.en,
                bodyPart: t(`bodyParts.${libraryEntry.bodyPartKey}`),
                equipment: t(`equipment.${libraryEntry.equipmentKey}`),
                target: displayPrimary[0] || 'N/A',
                primaryMuscles: displayPrimary,
                secondaryMuscles: displaySecondary,
                instructions: libraryEntry.instructions[currentLang] || libraryEntry.instructions.en,
            };
        } else if (customEntry) {
            
            const rawPrimaryKeys = (customEntry as any).primaryMuscleKeys || [(customEntry as any).target];
            const rawSecondaryKeys = (customEntry as any).secondaryMuscleKeys || (customEntry as any).secondaryMuscles || [];

            const primaryKeys = (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
            const secondaryKeys = (Array.isArray(rawSecondaryKeys) ? rawSecondaryKeys : [rawSecondaryKeys]).filter((key): key is string => Boolean(key));

            const displayPrimary = getDisplayMuscleNames({ specificKeys: primaryKeys, displayDetailed, t });
            const displaySecondary = getDisplayMuscleNames({ specificKeys: secondaryKeys, displayDetailed, t });

            resolved = {
                name: customEntry.name,
                bodyPart: t(`bodyParts.${customEntry.bodyPart}`),
                equipment: t(`equipment.${customEntry.equipment}`),
                target: displayPrimary[0] || 'N/A',
                primaryMuscles: displayPrimary,
                secondaryMuscles: displaySecondary,
                instructions: customEntry.instructions?.slice() || [],
            };
        } else {
            
            
            return {
                id: exercise.templateId,
                name: exercise.name || t('app.templateNotFound', "Exercise Not Found"),
                bodyPart: "N/A",
                equipment: "N/A",
                target: "N/A",
                primaryMuscles: [],
                secondaryMuscles: [],
                instructions: [],
            };
        }
        
        
        if (exercise.name) {
            resolved.name = exercise.name;
        }

        return {
            id: exercise.templateId,
            ...resolved,
        } as TExerciseLibraryItem;

    }, [exercise, t, i18n.language, customExercises, settings]);
}