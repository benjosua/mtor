import { useMemo } from 'react';
import { masterLibrary } from '@/data/master-library';
import { useCustomExercises } from '@/jazz/db';

export function usePrimaryMuscleKeys(templateId: string | undefined | null) {
    const { customExercises } = useCustomExercises();

    return useMemo(() => {
        if (!templateId) return [];

        const libEntry = masterLibrary[templateId];
        if (libEntry) {
            return libEntry.primaryMuscleKeys;
        }

        const customEntry = customExercises?.find(c => c.$jazz.id === templateId);
        if (customEntry) {
            
            const rawPrimaryKeys = (customEntry as any).primaryMuscleKeys || ((customEntry as any).target ? [(customEntry as any).target] : []);
            return (Array.isArray(rawPrimaryKeys) ? rawPrimaryKeys : [rawPrimaryKeys]).filter((key): key is string => Boolean(key));
        }

        return [];
    }, [templateId, customExercises]);
}
