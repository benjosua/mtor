import { useMyAccount } from "@/jazz/db";
import { co, z } from "jazz-tools";
import { useCallback, useMemo } from "react";

export function useExerciseNote(templateId: string | undefined) {
    const { me: account } = useMyAccount();
    const me = account?.me;
    const isCustom = templateId?.startsWith('custom_');

    const note = useMemo(() => {
        if (!templateId || !me?.root) return undefined;

        if (isCustom) {
            return me.root.customExercises?.[templateId]?.notes;
        } else {
            return me.root.exerciseNotes?.[templateId];
        }
    }, [me, templateId, isCustom]);

    const setNote = useCallback((newNote: string) => {
        if (!templateId || !me?.root) return;

        const noteToSave = newNote.trim() ? newNote : undefined;

        if (isCustom) {
            const customExercise = me.root.customExercises?.[templateId];
            if (customExercise) {
                customExercise.$jazz.set("notes", noteToSave);
            }
        } else {
            
            if (!me.root.exerciseNotes) {
                me.root.$jazz.set("exerciseNotes", co.record(z.string(), z.string()).create({}));
            }

            if (noteToSave) {
                me.root.exerciseNotes?.$jazz.set(templateId, noteToSave);
            } else {
                
                me.root.exerciseNotes?.$jazz.delete(templateId);
            }
        }
    }, [me, templateId, isCustom]);

    return { note, setNote };
}